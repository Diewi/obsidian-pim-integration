import { Err, Ok, Result } from 'oxide.ts';
import { IBackendOutlookNativeExecutor } from './IBackendOutlookNativeExecutor';
import { NativeExecutorCli } from '../NativeExecutorCli';
import { native_bridge } from '../../../src_generated/native_bridge';

// Re-export generated types for convenience
export type ExportResult = native_bridge.IExportResult;

/**
 * Outlook-specific CLI executor that spawns OutlookComBridge.exe as a child process.
 *
 * Extends the generic CLI executor with Outlook contact export functionality.
 * Only handles ExportResult extraction - all CliResponse parsing is in the base class.
 */
export class BackendOutlookNativeExecutorCli
  extends NativeExecutorCli
  implements IBackendOutlookNativeExecutor
{
  /**
   * @param comBridgePath Path to the outlookcombridge directory containing the CLI tool.
   * @param useJson If true, use --json flag for human-readable output (debugging). Default: false (binary protobuf).
   * @param useTestData If true, use --test-data flag to get synthetic test data. Default: false.
   */
  constructor(comBridgePath: string, useJson: boolean = false, useTestData: boolean = false) {
    const exeName = process.platform === 'win32' ? 'OutlookComBridge.exe' : 'OutlookComBridge';
    super(comBridgePath, exeName, useJson, useTestData);
  }

  /**
   * Extract vCard data from ExportResult.
   * Returns merged vCard string or individual vCards concatenated.
   */
  private getVCardFromExportResult(exportResult: native_bridge.IExportResult): string {
    // Prefer merged vCards if available
    if (exportResult.mergedVcards) {
      return exportResult.mergedVcards;
    }

    // Otherwise concatenate individual vCards
    if (exportResult.vcards?.vcards && exportResult.vcards.vcards.length > 0) {
      return exportResult.vcards.vcards.join('\n');
    }

    return '';
  }

  /**
   * Extract individual vCard strings from ExportResult.
   */
  private getVCardsFromExportResult(exportResult: native_bridge.IExportResult): string[] {
    if (exportResult.vcards?.vcards) {
      return exportResult.vcards.vcards;
    }
    return [];
  }

  async exportContacts(): Promise<Result<string, string>> {
    const result = await this.executeCommandProtobuf('export-contacts');
    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    const response = result.unwrap();
    if (!response.success) {
      return Err(response.errorMessage || 'Unknown error');
    }

    const exportResult = response.exportResult;
    if (!exportResult) {
      return Err('No export result returned');
    }

    return Ok(this.getVCardFromExportResult(exportResult));
  }

  /**
   * Export contacts and return individual vCard strings.
   */
  async exportContactsAsVCards(): Promise<Result<string[], string>> {
    const result = await this.executeCommandProtobuf('export-contacts');
    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    const response = result.unwrap();
    if (!response.success) {
      return Err(response.errorMessage || 'Unknown error');
    }

    const exportResult = response.exportResult;
    if (!exportResult) {
      return Err('No export result returned');
    }

    return Ok(this.getVCardsFromExportResult(exportResult));
  }
}
