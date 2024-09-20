import { Result, Ok, Err } from 'oxide.ts';
import { vCardTs2_1 } from 'typed-vcard/src/vCardTs2_1';
import { vCardTs3_0 } from 'typed-vcard/src/vCardTs3_0';
import { vCardTs4_0 } from 'typed-vcard/src/vCardTs4_0';
import { PimIntegrationContactImporterBase } from '../src/contacts/ContactImporterBase';
import * as fs from 'fs';

export class MockPimIntegrationContactImporterVCFMarkdown extends PimIntegrationContactImporterBase {
  constructor(pluginDir: string, contactDir: string, targetTemplate: string) {
    super(pluginDir, contactDir, targetTemplate);
  }

  getContactRefName(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string> {
    if (!vCard.formattedName) {
      return Err('No formatted name found');
    }
    return Ok(vCard.formattedName);
  }

  writeToFile(content: string, contactName: string): void {
    const filePath = `${this.contactDir}/${contactName}.md`;
    fs.writeFile(filePath, content, function (err) {
      if (err) {
        return console.error(err);
      }
      console.log(`File ${filePath} created!`);
    });
  }
}
