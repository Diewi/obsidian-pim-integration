import { App } from 'obsidian/obsidian';
import { Result, Ok, Err } from 'oxide.ts/dist';
import { vCardTs2_1 } from 'typed-vcard/src/vCardTs2_1';
import { vCardTs3_0 } from 'typed-vcard/src/vCardTs3_0';
import { vCardTs4_0 } from 'typed-vcard/src/vCardTs4_0';
import { PimIntegrationContactImporterBase } from './ContactImporterBase';

export class PimIntegrationContactImporterVCFMarkdown extends PimIntegrationContactImporterBase {
  protected app: App;

  constructor(app: App, pluginDir: string, contactDir: string, targetTemplate: string) {
    super(pluginDir, contactDir, targetTemplate);
    this.app = app;
  }

  getContactRefName(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string> {
    if (!vCard.formattedName) {
      return Err('No formatted name found');
    }
    return Ok(vCard.formattedName);
  }

  async writeToFile(content: string, filePath: string): Promise<void> {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dir && !(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    await this.app.vault.adapter.write(filePath, content);
  }

  async fileExists(filePath: string): Promise<boolean> {
    return this.app.vault.adapter.exists(filePath);
  }
}
