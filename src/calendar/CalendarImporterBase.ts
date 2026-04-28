import { ICalendarImporter } from './CalendarImporter';
import { ICalendarImporterBackend } from './ICalendarImporterBackend';
import { CalendarEvent } from './CalendarEvent';
import { CalendarEventParser } from './CalendarEventParser';
import { IVaultEventScanner } from './IVaultEventScanner';
import { ITemplateEngine } from '../templateEngine/ITemplateEngine';
import { TemplateEngine } from '../templateEngine/TemplateEngine';
import { sanitizeFilename } from '../utils/fileUtils';
import { Err, Ok, Result } from 'oxide.ts';

export abstract class CalendarImporterBase implements ICalendarImporter {

  protected calendarDir: string;
  protected targetTemplate: string;
  protected vaultEventScanner: IVaultEventScanner | null = null;
  protected includePrivate: boolean = false;
  protected excludeAllDay: boolean = true;
  private templateEngine: ITemplateEngine;

  constructor(calendarDir: string, targetTemplate: string, includePrivate: boolean = false, excludeAllDay: boolean = true) {
    this.calendarDir = calendarDir;
    this.targetTemplate = targetTemplate;
    this.templateEngine = new TemplateEngine();
    this.includePrivate = includePrivate;
    this.excludeAllDay = excludeAllDay;
  }

  async transformCalendarEvents(
    backend: ICalendarImporterBackend,
    startDate: Date,
    endDate: Date
  ): Promise<Result<string, string>> {
    const icalResult = await backend.getCalendarEvents(startDate, endDate);
    if (icalResult.isErr()) {
      return Err(icalResult.unwrapErr());
    }

    return this.transformICalToTargetFormat(icalResult.unwrap(), startDate, endDate);
  }

  async transformICalToTargetFormat(
    icalString: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Result<string, string>> {
    const allEvents = CalendarEventParser.parseICalEvents(icalString);

    // Consider only events whose startDate falls within the requested range.
    // Outlook's CalendarSharing exporter returns the full recurring series context
    // (masters + exceptions) which may include events outside the requested day.
    let events = (startDate && endDate)
      ? allEvents.filter((e) => e.startDate && e.startDate >= startDate && e.startDate < endDate)
      : allEvents;

    // Filter out private/confidential events unless explicitly included.
    // Outlook's IncludePrivateDetails=false strips details but still exports the VEVENT
    // with CLASS:PRIVATE/CONFIDENTIAL. We filter them client-side.
    if (!this.includePrivate) {
      events = events.filter((e) => {
        const cls = e.classType.toUpperCase();
        return cls !== 'PRIVATE' && cls !== 'CONFIDENTIAL';
      });
    }

    // Filter out all-day events when the user opts to exclude them.
    if (this.excludeAllDay) {
      events = events.filter((e) => !e.isAllDay);
    }

    if (events.length === 0) {
      return Ok('No calendar events found in the given range.');
    }

    const failedTransformations: CalendarEvent[] = [];
    let importedCount = 0;
    for (const event of events) {
      this.resolvePreviousEventLink(event);

      const template = await this.resolveCarryForward(this.targetTemplate, event);

      const contentResult = this.transformSingleEvent(event, template);
      if (contentResult.isErr()) {
        failedTransformations.push(event);
        continue;
      }

      const filePath = this.resolveFilePath(event);
      if (filePath.isErr()) {
        failedTransformations.push(event);
        continue;
      }
      try {
        await this.writeToFile(contentResult.unwrap(), filePath.unwrap());
        importedCount++;
      } catch (e) {
        console.error(`[CalendarImporter] Failed to write ${filePath.unwrap()}: ${e}`);
        failedTransformations.push(event);
      }
    }

    if (failedTransformations.length === 0) {
      return Ok(`${importedCount} calendar event(s) imported successfully.`);
    } else {
      const failedSummaries = failedTransformations
        .map((e) => e.summary || '(no summary)')
        .join(', ');
      console.error(
        `[CalendarImporter] ${failedTransformations.length} event(s) failed: ${failedSummaries}`
      );
      return Err(
        `${importedCount} event(s) imported, ${failedTransformations.length} failed: ${failedSummaries}`
      );
    }
  }

  transformSingleEvent(event: CalendarEvent, template?: string): Result<string, string> {
    const instance = this.templateEngine.substitute(template ?? this.targetTemplate, event);
    if (instance.isErr()) {
      return instance;
    }
    return Ok(instance.unwrap().trim());
  }

  /**
   * Derive the default filename for an event in folder-only mode.
   * Returns "YYYY-MM-DD Summary" with illegal filename characters sanitized.
   *
   * This is only used when calendarDir does not end with a file extension
   * (i.e. full-path mode is not active). In full-path mode, the filename
   * is specified entirely via the settings template.
   *
   * Sanitization is applied here as a defence-in-depth measure because the
   * refName is also used in the resolveFilePath output. The full-path mode
   * applies its own sanitization via {@link sanitizeFilePath}.
   */
  getDefaultEventFileName(event: CalendarEvent): Result<string, string> {
    if (!event.summary) {
      return Err('Event has no summary');
    }
    const prefix = event.startDate ? event.startDate.toISOString().slice(0, 10) : 'undated';
    const safeSummary = sanitizeFilename(event.summary);
    return Ok(`${prefix} ${safeSummary}`);
  }

  /**
   * Sanitize a resolved file path by replacing characters that are illegal
   * in Windows filenames from the filename portion (last path segment).
   *
   * Unlike {@link getDefaultEventFileName} (folder-only mode) which also
   * replaces `/` because the entire value becomes a single filename, this
   * method preserves `/` since it separates directory segments in a
   * full-path template.
   */
  static sanitizeFilePath(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
    const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : '';
    return dir + sanitizeFilename(filename);
  }

  /**
   * Create a shallow copy of the event with string properties sanitized for
   * use in file path templates.  Characters illegal in filenames (including
   * `/`) are replaced so that substituted values cannot introduce phantom
   * directory segments.
   */
  static sanitizeEventForPath(event: CalendarEvent): CalendarEvent {
    return {
      ...event,
      summary: sanitizeFilename(event.summary ?? ''),
      description: sanitizeFilename(event.description ?? ''),
      location: sanitizeFilename(event.location ?? ''),
      organizer: sanitizeFilename(event.organizer ?? ''),
      status: sanitizeFilename(event.status ?? ''),
      attendees: sanitizeFilename(event.attendees ?? ''),
    };
  }

  /**
   * Resolve placeholders in the calendar directory path using event data.
   * Supports the same ${property} syntax as the template engine,
   * including pipe transforms like ${startDate|yyyy-MM-dd}.
   * Returns Err if the resolved path contains empty segments (e.g. from null dates).
   */
  resolveCalendarDir(event: CalendarEvent): Result<string, string> {
    const safeEvent = CalendarImporterBase.sanitizeEventForPath(event);
    const resolvedResult = this.templateEngine.substitute(this.calendarDir, safeEvent);
    if (resolvedResult.isErr()) {
      return resolvedResult;
    }
    const resolved = resolvedResult.unwrap();
    // Detect empty path segments produced by unresolvable placeholders (e.g. null dates)
    if (this.calendarDir.includes('${') && resolved.includes('//')) {
      return Err(
        `Cannot resolve calendar directory "${this.calendarDir}" for event ` +
        `"${event.summary || '(no summary)'}": resolved to "${resolved}" which contains empty segments.`
      );
    }
    return Ok(resolved);
  }

  /**
   * Resolve ${carryForward} placeholder in the template.
   * Reads the previous occurrence note and extracts all sections whose
   * headings contain the `%% carryForward %%` Obsidian comment marker.
   * The marker is preserved in the carried-forward content so it chains
   * automatically to subsequent occurrences.
   * If no previous note exists or no marked sections are found, the
   * placeholder is removed.
   */
  async resolveCarryForward(template: string, event: CalendarEvent): Promise<string> {
    if (!template.includes('${carryForward}')) {
      return template;
    }

    // Extract previous note basename from the already-resolved wikilink
    const prevBasename = event.previousEventLink?.match(/\[\[(.+?)\]\]/)?.[1] ?? null;
    let prevContent: string | null = null;
    if (prevBasename && this.vaultEventScanner) {
      const baseDir = this.getCalendarBaseDir();
      prevContent = await this.vaultEventScanner.readNoteContent(prevBasename, baseDir);
    }

    const sections = prevContent
      ? CalendarImporterBase.extractMarkedSections(prevContent)
      : '';

    return template.replace(/\$\{carryForward\}/g, sections);
  }

  /**
   * Extract all markdown sections whose headings match the given predicate.
   * Each section includes the heading line and body up to the next heading
   * of equal or higher level. Trailing blank lines are trimmed.
   */
  static extractSections(content: string, predicate: (headingLine: string) => boolean): string[] {
    const lines = content.split('\n');
    const sections: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s/);
      if (!headingMatch || !predicate(line)) {
        continue;
      }

      const targetLevel = headingMatch[1].length;
      const startIdx = i;

      // Find end: next heading of equal or higher level
      let endIdx = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const nextMatch = lines[j].match(/^(#{1,6})\s/);
        if (nextMatch && nextMatch[1].length <= targetLevel) {
          endIdx = j;
          break;
        }
      }

      // Trim trailing blank lines
      while (endIdx > startIdx + 1 && lines[endIdx - 1].trim() === '') {
        endIdx--;
      }

      sections.push(lines.slice(startIdx, endIdx).join('\n'));
    }

    return sections;
  }

  static extractMarkedSections(content: string): string {
    const MARKER = '%% carryForward %%';
    return CalendarImporterBase.extractSections(content, (line) => line.includes(MARKER)).join('\n\n');
  }

  static extractSection(content: string, heading: string): string {
    if (!heading.match(/^(#{1,6})\s/)) {
      return '';
    }
    return CalendarImporterBase.extractSections(content, (line) => line.trim() === heading.trim())[0] ?? '';
  }

  /**
   * If the event belongs to a recurring series (non-empty uid and recurrenceRule)
   * look up the most recent previous occurrence note and set
   * event.previousEventLink to a wikilink.
   *
   * Requires a vault scanner to be set. If none is available (e.g. in unit
   * tests without an Obsidian vault), the link is left empty.
   */
  resolvePreviousEventLink(event: CalendarEvent): void {
    if (!event.uid || !event.recurrenceRule) {
      event.previousEventLink = '';
      return;
    }
    if (!this.vaultEventScanner) {
      console.warn('[CalendarImporter] No vault event scanner available — cannot resolve previous event link.');
      event.previousEventLink = '';
      return;
    }

    const baseDir = this.getCalendarBaseDir();
    const beforeDateStr = event.startDate ? event.startDate.toISOString().slice(0, 10) : '';
    const prevNote = this.vaultEventScanner.findPreviousOccurrenceNote(
      event.uid,
      beforeDateStr,
      baseDir
    );
    event.previousEventLink = prevNote ? `[[${prevNote}]]` : '';
  }

  /**
   * Resolve the complete file path for an event.
   * If calendarDir ends with the configured file extension, it is treated as
   * a full path template (directory + filename) and resolved as-is.
   * Otherwise, the auto-generated default event filename is appended.
   */
  resolveFilePath(event: CalendarEvent, fileExtension: string = '.md'): Result<string, string> {
    if (this.calendarDir.endsWith(fileExtension)) {
      const safeEvent = CalendarImporterBase.sanitizeEventForPath(event);
      const resolvedResult = this.templateEngine.substitute(this.calendarDir, safeEvent);
      if (resolvedResult.isErr()) {
        return resolvedResult;
      }
      const resolved = resolvedResult.unwrap();
      if (this.calendarDir.includes('${') && resolved.includes('//')) {
        return Err(
          `Cannot resolve calendar path "${this.calendarDir}" for event ` +
          `"${event.summary || '(no summary)'}": resolved to "${resolved}" which contains empty segments.`
        );
      }
      return Ok(CalendarImporterBase.sanitizeFilePath(resolved));
    }

    const resolvedDir = this.resolveCalendarDir(event);
    if (resolvedDir.isErr()) {
      return resolvedDir;
    }
    const refName = this.getDefaultEventFileName(event);
    if (refName.isErr()) {
      return refName;
    }
    return Ok(`${resolvedDir.unwrap()}/${refName.unwrap()}${fileExtension}`);
  }

  /**
   * Extract the static prefix of calendarDir before the first placeholder.
   * If calendarDir ends with the file extension (full path mode), the
   * filename portion is stripped before extracting the prefix.
   * E.g. "Calendar/${startDate}/notes" → "Calendar/"
   *      "Resources/Calendar" → "Resources/Calendar"
   *      "Calendar/${startDate|yyyy-MM-dd}.md" → "Calendar/"
   */
  getCalendarBaseDir(fileExtension: string = '.md'): string {
    let dir = this.calendarDir;
    // In full-path mode, strip the filename to get the directory portion
    if (dir.endsWith(fileExtension)) {
      const lastSlash = dir.lastIndexOf('/');
      dir = lastSlash >= 0 ? dir.slice(0, lastSlash) : '';
    }
    const idx = dir.indexOf('${');
    if (idx < 0) {
      return dir;
    }
    // Cut at the last '/' before the first placeholder
    const prefix = dir.slice(0, idx);
    const lastSlash = prefix.lastIndexOf('/');
    return lastSlash >= 0 ? prefix.slice(0, lastSlash + 1) : '';
  }

  abstract writeToFile(mdContent: string, filePath: string): Promise<void>;
}
