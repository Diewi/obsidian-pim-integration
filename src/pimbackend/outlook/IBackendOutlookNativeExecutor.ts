import { Result } from 'oxide.ts';
import { INativeExecutor, NativeExecutionMode } from '../INativeExecutor';

/**
 * Backend execution mode for Outlook native operations.
 * Re-export from generic executor for backward compatibility.
 */
export type OutlookBackendMode = NativeExecutionMode;

/**
 * Interface for executing Outlook-specific native operations.
 * Extends the generic native executor interface with Outlook-specific methods.
 *
 * Implementations can use either CLI process or edge-js based on mode.
 */
export interface IBackendOutlookNativeExecutor extends INativeExecutor {
  /**
   * Export contacts from Outlook as merged vCard data.
   * @returns Promise resolving to vCard string or error message.
   */
  exportContacts(): Promise<Result<string, string>>;

  /**
   * Export calendar events for a time range as iCalendar data.
   * @param startDate Start of the export range (UTC).
   * @param endDate End of the export range (UTC).
   * @param includePrivate Whether to include private events.
   * @param calendarFolder Optional calendar folder name (empty = default calendar).
   * @returns Promise resolving to iCalendar string or error message.
   */
  exportCalendar(
    startDate: Date,
    endDate: Date,
    includePrivate?: boolean,
    calendarFolder?: string
  ): Promise<Result<string, string>>;
}
