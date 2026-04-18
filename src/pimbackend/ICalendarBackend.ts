import { Result } from 'oxide.ts';
import { ICalendarImporterBackend } from '../calendar/ICalendarImporterBackend';

export interface ICalendarBackend {
  createCalendarImporter(): Result<ICalendarImporterBackend, string>;
}
