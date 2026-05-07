import { App } from 'obsidian/obsidian';
import { CalendarImporterBase } from './CalendarImporterBase';
import { ObsidianVaultEventScanner } from './ObsidianVaultEventScanner';

export class CalendarImporterMarkdown extends CalendarImporterBase {
  protected app: App;

  constructor(app: App, calendarDir: string, targetTemplate: string, includePrivate: boolean = false, excludeAllDay: boolean = true) {
    super(calendarDir, targetTemplate, includePrivate, excludeAllDay);
    this.app = app;
    this.vaultEventScanner = new ObsidianVaultEventScanner(app);
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
