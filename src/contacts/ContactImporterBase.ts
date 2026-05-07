import { PimIntegrationContactImporter } from './ContactImporter';
import { Err, Ok, Result } from 'oxide.ts';
import { vCardTs2_1 } from 'typed-vcard/src/vCardTs2_1';
import { vCardTs3_0 } from 'typed-vcard/src/vCardTs3_0';
import { vCardTs4_0 } from 'typed-vcard/src/vCardTs4_0';
import { ITemplateEngine } from '../templateEngine/ITemplateEngine';
import { TemplateEngine } from '../templateEngine/TemplateEngine';
import { IContactTransformer } from './IContactTransformer';
import { IContactBackend } from '../pimbackend/IContactBackend';
import { TypedVCardImpl } from 'typed-vCard/src/TypedVCardImpl';
import { sanitizeFilename } from '../utils/fileUtils';

export abstract class PimIntegrationContactImporterBase
  implements PimIntegrationContactImporter, IContactTransformer
{
  protected pluginDir: string;
  protected contactDir: string;
  protected targetTemplate: string;
  private templateEngine: ITemplateEngine;

  constructor(pluginDir: string, contactDir: string, targetTemplate: string) {
    this.pluginDir = pluginDir;
    this.contactDir = contactDir;
    this.targetTemplate = targetTemplate;
    this.templateEngine = new TemplateEngine();
  }

  transformContacts(backend: IContactBackend): Promise<Result<string, string>> {
    const importer = backend.createContactImporter();
    if (importer.isErr()) {
      return Promise.resolve(Err(importer.unwrapErr()));
    }
    let transformResult = new Promise<Result<string, string>>(async (resolve, reject) => {
      let contactResult: Promise<Result<string, string>> = importer.unwrap().getContacts();
      console.log('Contact Result Promise obtained.');
      contactResult.then((result) => {
        console.log('Contact Result obtained.');
        if (result.isErr()) {
          reject(result.unwrapErr());
          return;
        }

        console.log('Resolving to transformation.');
        resolve(this.transformContactsToTargetFormat(result.unwrap()));
      });
    });

    return transformResult;
  }

  async transformContactsToTargetFormat(vCards: string): Promise<Result<string, string>> {
    console.log('Transforming contacts to target format.');
    const typedVCards = new TypedVCardImpl(vCards);
    // FIXME: The call to the correct getters must be dynamic based on the vCard version or the backend
    let failedTransformations: vCardTs2_1[] = [];
    let writtenCount = 0;
    let verifiedCount = 0;
    for (const vCard of typedVCards.getVCardsV2_1()) {
      const contentResult = this.transformSingleContact(vCard);
      if (contentResult.isErr()) {
        failedTransformations.push(vCard);
        continue;
      }

      const content = contentResult.unwrap();
      const filePath = this.resolveFilePath(vCard);
      if (filePath.isErr()) {
        failedTransformations.push(vCard);
        continue;
      }

      try {
        await this.writeToFile(content, filePath.unwrap());
        writtenCount++;
        if (await this.fileExists(filePath.unwrap())) {
          verifiedCount++;
        }
      } catch (e) {
        console.error(`[ContactImporter] Failed to write ${filePath.unwrap()}: ${e}`);
        failedTransformations.push(vCard);
      }
    }

    const summary = PimIntegrationContactImporterBase.formatImportSummary(
      writtenCount, verifiedCount, failedTransformations.length
    );
    if (failedTransformations.length === 0) {
      return Ok(summary);
    } else {
      return Err(summary);
    }
  }

  static formatImportSummary(writtenCount: number, verifiedCount: number, failedCount: number): string {
    const parts: string[] = [];
    parts.push(`${writtenCount} contact(s) written`);
    if (verifiedCount < writtenCount) {
      parts.push(`${verifiedCount}/${writtenCount} verified on disk`);
    } else {
      parts.push(`all verified on disk`);
    }
    if (failedCount > 0) {
      parts.push(`${failedCount} failed`);
    }
    return parts.join(', ');
  }

  transformSingleContact(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string> {
    const instance = this.templateEngine.substitute(this.targetTemplate, vCard);
    if (instance.isErr()) {
      return instance;
    }
    return Ok(instance.unwrap().trim());
  }

  /**
   * Resolve the file path for a contact.
   * If contactDir ends with `.md`, it is treated as a full-path template
   * with variable substitution (e.g. `Contacts/${formattedName}.md`).
   * Otherwise, the contact ref name is appended to the directory.
   */
  resolveFilePath(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0, fileExtension: string = '.md'): Result<string, string> {
    if (this.contactDir.endsWith(fileExtension)) {
      const safeVCard = PimIntegrationContactImporterBase.sanitizeVCardForPath(vCard);
      const resolvedResult = this.templateEngine.substitute(this.contactDir, safeVCard);
      if (resolvedResult.isErr()) {
        return resolvedResult;
      }
      const resolved = resolvedResult.unwrap();
      return Ok(PimIntegrationContactImporterBase.sanitizeFilePath(resolved));
    }

    const contactRef = this.getContactRefName(vCard);
    if (contactRef.isErr()) {
      return contactRef;
    }
    const safeName = sanitizeFilename(contactRef.unwrap());
    return Ok(`${this.contactDir}/${safeName}${fileExtension}`);
  }

  /**
   * Sanitize the filename portion of a resolved file path.
   * Preserves `/` as directory separators but replaces illegal characters
   * in the last path segment.
   */
  static sanitizeFilePath(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
    const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : '';
    return dir + sanitizeFilename(filename);
  }

  /**
   * Create a shallow copy of the vCard with string properties sanitized for
   * use in file path templates. Characters illegal in filenames (including `/`)
   * are replaced so that substituted values cannot introduce phantom directory segments.
   */
  static sanitizeVCardForPath(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Record<string, unknown> {
    const result: Record<string, unknown> = { ...vCard };
    for (const key of Object.keys(result)) {
      if (typeof result[key] === 'string') {
        result[key] = sanitizeFilename(result[key] as string);
      }
    }
    return result;
  }

  abstract getContactRefName(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string>;

  abstract writeToFile(mdContent: string, filePath: string): Promise<void>;

  abstract fileExists(filePath: string): Promise<boolean>;
}
