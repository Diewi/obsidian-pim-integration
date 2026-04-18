import { Result } from 'oxide.ts';
import { ICalendarImporterBackend } from './ICalendarImporterBackend';

export interface ICalendarImporter {
  transformCalendarEvents(
    backend: ICalendarImporterBackend,
    startDate: Date,
    endDate: Date
  ): Promise<Result<string, string>>;
}
