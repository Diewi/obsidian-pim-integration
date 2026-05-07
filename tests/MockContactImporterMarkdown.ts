import { Result, Ok, Err } from 'oxide.ts';
import { vCardTs2_1 } from 'typed-vcard/src/vCardTs2_1';
import { vCardTs3_0 } from 'typed-vcard/src/vCardTs3_0';
import { vCardTs4_0 } from 'typed-vcard/src/vCardTs4_0';
import { PimIntegrationContactImporterBase } from '../src/contacts/ContactImporterBase';
import * as fs from 'fs';
import * as path from 'path';

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

  async writeToFile(content: string, filePath: string): Promise<void> {
    const absPath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
    console.log(`File ${absPath} created!`);
  }

  async fileExists(filePath: string): Promise<boolean> {
    return fs.existsSync(path.resolve(filePath));
  }
}
