import { Err, Ok, Result } from 'oxide.ts';
import { IBackendOutlookNativeExecutor } from './IBackendOutlookNativeExecutor';
import { NativeExecutorEdge } from '../NativeExecutorEdge';

/**
 * Outlook-specific Edge executor that uses electron-edge-js for in-process .NET calls.
 *
 * Extends the generic Edge executor with Outlook-specific method bindings.
 * More efficient than CLI but requires native thread support.
 */
export class BackendOutlookNativeExecutorEdge
  extends NativeExecutorEdge
  implements IBackendOutlookNativeExecutor
{
  private static readonly DLL_NAME = 'OutlookComBridge.dll';
  private exportContactsFunc: any = null;

  /**
   * @param comBridgePath Path to the outlookcombridge directory containing DLL files.
   * @param dotnetPath Path to the .NET runtime installation directory.
   */
  constructor(comBridgePath: string, dotnetPath: string = 'C:\\Program Files\\dotnet') {
    super(comBridgePath, dotnetPath);
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
      const dllPath = this.getDllPath(BackendOutlookNativeExecutorEdge.DLL_NAME);

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
}
