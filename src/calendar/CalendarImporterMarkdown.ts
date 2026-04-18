import { App } from 'obsidian/obsidian';
import { CalendarImporterBase } from './CalendarImporterBase';
import { ObsidianVaultEventScanner } from './ObsidianVaultEventScanner';

export class CalendarImporterMarkdown extends CalendarImporterBase {
  protected app: App;

  constructor(app: App, calendarDir: string, targetTemplate: string, includePrivate: boolean = false) {
    super(calendarDir, targetTemplate, includePrivate);
    this.app = app;
    this.vaultEventScanner = new ObsidianVaultEventScanner(app);
  }

  async writeToFile(content: string, filePath: string): Promise<void> {
    await this.app.vault.adapter.write(filePath, content);
  }
}
