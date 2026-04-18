import { Err, Ok, Result } from 'oxide.ts';
import { IBackendOutlookNativeExecutor } from './IBackendOutlookNativeExecutor';
import { NativeExecutorEdge } from '../NativeExecutorEdge';

/**
 * Outlook-specific Edge executor that uses electron-edge-js for in-process .NET calls.
 *
 * Extends the generic Edge executor with Outlook-specific method bindings.
 * More efficient than CLI but requires native thread support.
 */
export class OutlookNativeExecutorEdge
  extends NativeExecutorEdge
  implements IBackendOutlookNativeExecutor
{
  private static readonly DLL_NAME = 'OutlookComBridge.dll';
  private exportContactsFunc: any = null;

  /**
   * @param comBridgePath Path to the outlookcombridge directory containing DLL files.
   */
  constructor(comBridgePath: string) {
    super(comBridgePath);
  }

  /**
   * Ensure Outlook-specific edge functions are loaded.
   */
  private async ensureOutlookFunctionsLoaded(): Promise<Result<void, string>> {
    if (this.exportContactsFunc) {
      return Ok(undefined);
    }

    const loadResult = await this.ensureEdgeLoaded();
    if (loadResult.isErr()) {
      return loadResult;
    }

    try {
      const edgeModule = this.getEdgeModule();
      const dllPath = this.getDllPath(OutlookNativeExecutorEdge.DLL_NAME);

      this.exportContactsFunc = edgeModule.func({
        assemblyFile: dllPath,
        typeName: 'OutlookContactBridge',
        methodName: 'ExportContacts',
      });

      return Ok(undefined);
    } catch (err) {
      return Err(`Failed to create Outlook edge functions: ${err}`);
    }
  }

  async exportContacts(): Promise<Result<string, string>> {
    const loadResult = await this.ensureOutlookFunctionsLoaded();
    if (loadResult.isErr()) {
      return Err(loadResult.unwrapErr());
    }

    try {
      const contacts = await this.exportContactsFunc({});
      return Ok(contacts as string);
    } catch (err) {
      return Err(`Export failed: ${err}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exportCalendar(
    startDate: Date,
    endDate: Date,
    includePrivate?: boolean,
    calendarFolder?: string
  ): Promise<Result<string, string>> {
    return Err('Calendar export via Edge is not yet implemented. Use CLI backend variant.');
  }
}
