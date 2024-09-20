import { PimIntegrationContactImporter } from './ContactImporter';
import { Err, Ok, Result } from 'oxide.ts';
import { vCardTs2_1 } from 'typed-vcard/src/vCardTs2_1';
import { vCardTs3_0 } from 'typed-vcard/src/vCardTs3_0';
import { vCardTs4_0 } from 'typed-vcard/src/vCardTs4_0';
import { ITemplateEngine } from './ITemplateEngine';
import { TemplateEngine } from './TemplateEngine';
import { IContactTransformer } from './IContactTransformer';
import { IContactBackend } from '../pimbackend/IContactBackend';
import { TypedVCardImpl } from 'typed-vCard/src/TypedVCardImpl';

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
    const importer = backend.createImporter();
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

  transformContactsToTargetFormat(vCards: string): Promise<Result<string, string>> {
    console.log('Transforming contacts to target format.');
    return new Promise((resolve, reject) => {
      const typedVCards = new TypedVCardImpl(vCards);
      // FIXME: The call to the correct getters must be dynamic based on the vCard version or the backend
      let failedTransformations: vCardTs2_1[] = [];
      for (const vCard of typedVCards.getVCardsV2_1()) {
        const contentResult = this.transformSingleContact(vCard);
        if (contentResult.isErr()) {
          failedTransformations.push(vCard);
          continue;
        }

        const content = contentResult.unwrap();
        const contactRef = this.getContactRefName(vCard);
        if (contactRef.isErr()) {
          failedTransformations.push(vCard);
          continue;
        }

        this.writeToFile(content, contactRef.unwrap());
      }
      if (failedTransformations.length == 0) {
        resolve(Ok('All contacts transformed successfully.'));
      } else {
        resolve(Err(`Failed to transform ${failedTransformations.length} contacts.`));
      }
    });
  }

  transformSingleContact(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string> {
    const instance = this.templateEngine.substitute(this.targetTemplate, vCard);
    return Ok(instance.trim());
  }
  abstract getContactRefName(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string>;

  abstract writeToFile(mdContent: string, contactName: string): void;
}
