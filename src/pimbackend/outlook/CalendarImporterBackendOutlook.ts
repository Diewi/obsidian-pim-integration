import { ICalendarImporterBackend } from '../../calendar/ICalendarImporterBackend';
import { Err, Ok, Result } from 'oxide.ts';
import { IBackendOutlookNativeExecutor, OutlookBackendMode } from './IBackendOutlookNativeExecutor';
import { OutlookNativeExecutorFactory } from './BackendOutlookNativeExecutorFactory';

export class CalendarImporterBackendOutlook implements ICalendarImporterBackend {
  private readonly executor: IBackendOutlookNativeExecutor;
  private readonly calendarFolder: string;
  private readonly includePrivate: boolean;

  private static readonly LOG_PREFIX = '[CalendarImporterBackendOutlook]';

  // TODO: In line with the contact importer, add support for library(non-exe)-besed import and corresponding tests.
  constructor(
    comBridgePath: string,
    mode: OutlookBackendMode = 'cli',
    useJsonForCli: boolean = false,
    dotnetPath: string = 'C:\\Program Files\\dotnet',
    calendarFolder: string = '',
    includePrivate: boolean = false
  ) {
    this.executor = OutlookNativeExecutorFactory.create(
      mode,
      comBridgePath,
      useJsonForCli,
      dotnetPath
    );
    this.calendarFolder = calendarFolder;
    this.includePrivate = includePrivate;
    console.log(`${CalendarImporterBackendOutlook.LOG_PREFIX} Using ${mode} executor` +
      (calendarFolder ? `, calendar folder: ${calendarFolder}` : ', default calendar') +
      `, includePrivate: ${includePrivate}`);
  }

  async getCalendarEvents(startDate: Date, endDate: Date): Promise<Result<string, string>> {
    console.log(
      `${CalendarImporterBackendOutlook.LOG_PREFIX} Exporting calendar via ${this.executor.mode} executor`
    );
    return this.executor.exportCalendar(startDate, endDate, this.includePrivate, this.calendarFolder || undefined);
  }
}
