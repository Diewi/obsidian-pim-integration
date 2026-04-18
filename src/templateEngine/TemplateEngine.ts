import { format as dateFnsFormat } from 'date-fns';
import { Err, Ok, Result } from 'oxide.ts';

export enum LineEnding {
  Windows = 'windows',
  Unix = 'unix',
  None = 'none',
}

export class TemplateEngine {
  private get(obj: any, path: string): any {
    // Array property mapping with separator: members[].name|\n
    // Allow leading whitespace but preserve separator (including trailing spaces) as-is
    const arrayPropMatch = path.match(/^\s*([a-zA-Z0-9_]+)\[\]\.([a-zA-Z0-9_]+)(?:\|(.+))?$/);
    if (arrayPropMatch) {
      const arrKey = arrayPropMatch[1];
      const prop = arrayPropMatch[2];
      const sep = arrayPropMatch[3] !== undefined ? arrayPropMatch[3].replace(/\\n/g, '\n') : ',';
      const arr = obj[arrKey];
      if (Array.isArray(arr)) {
        return arr.map((item) => this.get(item, prop)).join(sep);
      }
      return '';
    }

    // Support array index access, e.g. teams[0].teamName or teams[1].members[1].name
    const trimmedPath = path.trim();
    const parts = trimmedPath.split('.');
    let current = obj;
    for (let part of parts) {
      // Match array index, e.g. friends[2]
      const arrIdxMatch = part.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);
      if (arrIdxMatch) {
        const arrKey = arrIdxMatch[1];
        const idx = parseInt(arrIdxMatch[2], 10);
        if (Array.isArray(current[arrKey]) && current[arrKey][idx] !== undefined) {
          current = current[arrKey][idx];
        } else {
          return undefined;
        }
      } else {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return undefined;
        }
      }
    }
    if (current !== undefined) return current;
    // Fallback to top-level key
    return obj[trimmedPath];
  }

  public substitute(
    template: string,
    data: any,
    lineEnding: LineEnding = LineEnding.Unix,
    rootData?: any
  ): Result<string, string> {
    try {
      return Ok(this.substituteInner(template, data, lineEnding, rootData));
    } catch (e) {
      return Err(`Template substitution failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private substituteInner(
    template: string,
    data: any,
    lineEnding: LineEnding = LineEnding.Unix,
    rootData?: any
  ): string {
    // Use rootData for global context, default to data if not provided
    const globalData = rootData ?? data;
    // Array template mapping with separator: array[].`template`|sep
    const arrayTemplateRegex = /\$\{([a-zA-Z0-9_]+)\[\]\.\`([\s\S]+?)\`(?:\|([^}]+))?\}/g;
    template = template.replace(arrayTemplateRegex, (_, arrKey, innerTemplate, sep) => {
      const arr = data[arrKey];
      const separator = sep !== undefined ? sep.replace(/\\n/g, '\n') : '\n';
      if (Array.isArray(arr)) {
        return arr
          .filter(
            (v) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')
          )
          .map((item) => this.substituteInner(innerTemplate, item, lineEnding, globalData))
          .filter((str) => typeof str === 'string' && str.trim() !== '')
          .join(separator);
      }
      return '';
    });

    // Single element array template mapping: array[index]`template`
    // Allow optional dot before the backtick and optional default after the template:
    // e.g. ${arr[0]`...`} ${arr[0].`...`} and ${arr[0].`...`??Default}
    const singleArrayTemplateRegex =
      /\$\{([a-zA-Z0-9_]+)\[(\d+)\](?:\.)?\`([\s\S]+?)\`(?:\?\?([^}]+))?\}/g;
    template = template.replace(
      singleArrayTemplateRegex,
      (_, arrKey, idx, innerTemplate, defaultValue) => {
        const arr = data[arrKey];
        const index = parseInt(idx, 10);
        if (Array.isArray(arr) && arr[index] !== undefined) {
          const substituted = this.substituteInner(innerTemplate, arr[index], lineEnding, globalData);
          if ((substituted === undefined || substituted === '') && defaultValue !== undefined) {
            const cleanedDefault = defaultValue.replace(/^\s*\?\?/, '');
            return this.substituteInner(cleanedDefault, globalData, lineEnding, globalData);
          }
          return substituted !== undefined ? substituted : '';
        }
        if (defaultValue !== undefined) {
          const cleanedDefault = defaultValue.replace(/^\s*\?\?/, '');
          return this.substituteInner(cleanedDefault, globalData, lineEnding, globalData);
        }
        return '';
      }
    );
    // Simple and nested property substitution, with separator support
    // Supports pipe transforms for Date values: ${startDate|yyyy-MM-dd}
    let result = template.replace(/\$\{([^}?]+)(?:\?\?([^}]+))?\}/g, (_, path, defaultValue) => {
      // Try resolving the full path first (includes array separator syntax like arr[].prop|sep)
      // Do NOT trim here — get() handles trimming internally, preserving separators
      let value = this.get(data, path);
      if ((value === undefined || value === '') && globalData !== data) {
        value = this.get(globalData, path);
      }

      // If no value found via full path, try splitting on '|' for date pipe transform
      let formatStr: string | null = null;
      if (value === undefined || value === '') {
        const pipeIdx = path.indexOf('|');
        if (pipeIdx >= 0) {
          const propPath = path.slice(0, pipeIdx).trim();
          formatStr = path.slice(pipeIdx + 1).trim();
          value = this.get(data, propPath);
          if ((value === undefined || value === '') && globalData !== data) {
            value = this.get(globalData, propPath);
          }
        }
      }

      // Treat null as empty for template purposes
      if (value === null) {
        value = undefined;
      }

      // If still empty and defaultValue is provided, recursively substitute defaultValue
      if ((value === undefined || value === '') && defaultValue !== undefined) {
        // Remove any leading '??' from the defaultValue before substitution
        const cleanedDefault = defaultValue.replace(/^\s*\?\?/, '');
        value = this.substituteInner(cleanedDefault, globalData, lineEnding, globalData);
      }
      // Apply date-fns format pipe if the value is a Date and a format string is provided.
      // date-fns formats in local time by default, which matches Outlook COM's local-time
      // DTSTART/DTEND values stored in JavaScript Date objects.
      if (formatStr && value instanceof Date) {
        return dateFnsFormat(value, formatStr);
      }
      if (Array.isArray(value)) {
        return value
          .filter(
            (v) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')
          )
          .join(',');
      }
      return value !== undefined ? value : '';
    });
    // Normalize line endings based on parameter
    if (lineEnding === LineEnding.Unix) {
      result = result.replace(/\r\n/g, '\n');
    } else if (lineEnding === LineEnding.Windows) {
      result = result.replace(/\r?\n/g, '\r\n');
    }
    // 'none' leaves line endings as-is
    return result;
  }
}
