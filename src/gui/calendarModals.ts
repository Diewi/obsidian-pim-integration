import { App } from 'obsidian';
import { PimIntegrationSettingsMgr } from '../settings';
import { Err, Ok, Result } from 'oxide.ts';
import { CalendarImporterMarkdown } from '../calendar/CalendarImporterMarkdown';
import { ObsidianUtils } from '../utils/obsidianUtils';
import { IBackendType } from '../pimbackend/IBackendType';
import { ICalendarBackend } from '../pimbackend/ICalendarBackend';

export class PimIntegrationImportCalendar {
  app: App;
  plugin_dir: string;
  settings: PimIntegrationSettingsMgr;
  backend: IBackendType;

  constructor(
    app: App,
    plugin_dir: string,
    settings: PimIntegrationSettingsMgr,
    backend: IBackendType
  ) {
    this.app = app;
    this.plugin_dir = plugin_dir;
    this.settings = settings;
    this.backend = backend;
  }

  /**
   * Import calendar events for a specific date.
   * Uses local-time boundaries so that the range matches the user's calendar day.
   * End boundary is exclusive (start of next day) so events on the following day
   * are not included.
   */
  importCalendarForDate(date: Date): Promise<Result<string, string>> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const startOfNextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0);
    return this.importCalendarRange(startOfDay, startOfNextDay);
  }

  /**
   * Import calendar events for today.
   */
  importCalendarForToday(): Promise<Result<string, string>> {
    return this.importCalendarForDate(new Date());
  }

  private importCalendarRange(
    startDate: Date,
    endDate: Date
  ): Promise<Result<string, string>> {
    const templatePath = this.settings.getSettingValue('calendarTemplate');
    const templateFile = this.app.vault.getFileByPath(templatePath);
    if (!templateFile) {
      const msg = `Calendar template file not found: ${templatePath}`;
      ObsidianUtils.logAndNotice(msg);
      return Promise.resolve(Err(msg));
    }

    return this.app.vault.read(templateFile).then((content) => {
      if (!content) {
        const msg = `Could not read calendar template file: ${templatePath}`;
        ObsidianUtils.logAndNotice(msg);
        return Err(msg);
      }

      const calendarBackend = this.backend as unknown as ICalendarBackend;
      const importerResult = calendarBackend.createCalendarImporter();
      if (importerResult.isErr()) {
        return Err(importerResult.unwrapErr());
      }

      const importer = new CalendarImporterMarkdown(
        this.app,
        this.settings.getSettingValue('calendarFolderPath'),
        content,
        this.settings.getSettingValue('includePrivateCalendarEvents')
      );

      return importer.transformCalendarEvents(importerResult.unwrap(), startDate, endDate);
    });
  }
}
