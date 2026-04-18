import { Result } from 'oxide.ts';

export interface ICalendarImporterBackend {
  /**
   * Fetch calendar events for a date range as an iCalendar string.
   * @param startDate Start of range (UTC).
   * @param endDate End of range (UTC).
   */
  getCalendarEvents(startDate: Date, endDate: Date): Promise<Result<string, string>>;
}
