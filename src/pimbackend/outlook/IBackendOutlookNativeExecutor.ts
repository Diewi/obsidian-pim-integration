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
}
