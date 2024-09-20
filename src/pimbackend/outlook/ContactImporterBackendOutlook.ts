import { IContactImporterBackend } from '../../contacts/IContactImporterBackend';
import { Err, Ok, Result } from 'oxide.ts';
import * as path from 'path';
import { IBackendOutlookNativeExecutor, OutlookBackendMode } from './IBackendOutlookNativeExecutor';
import { OutlookNativeExecutorFactory } from './BackendOutlookNativeExecutorFactory';

export class ContactImporterBackendOutlook implements IContactImporterBackend {
  private plugin_dir: string;
  private comBridgePath: string;

  private readonly executor: IBackendOutlookNativeExecutor;

  private static readonly LOG_PREFIX = '[ContactImporterBackendOutlook]';

  /**
   * Create a new ContactImporterBackendOutlook.
   *
   * @param plugin_dir Path to the plugin directory
   * @param comBridgePath Path to the outlookcombridge directory
   * @param mode Execution mode: 'cli' for process-based, 'edge' for in-process edge-js
   * @param useJsonForCli If true and mode is 'cli', use JSON output for debugging
   * @param dotnetPath Path to the .NET runtime installation directory (used by edge mode)
   */
  constructor(
    plugin_dir: string,
    comBridgePath: string,
    mode: OutlookBackendMode = 'cli',
    useJsonForCli: boolean = false,
    dotnetPath: string = 'C:\\Program Files\\dotnet'
  ) {
    this.plugin_dir = plugin_dir;
    this.comBridgePath = comBridgePath;
    this.executor = OutlookNativeExecutorFactory.create(
      mode,
      comBridgePath,
      useJsonForCli,
      dotnetPath
    );
    console.log(`${ContactImporterBackendOutlook.LOG_PREFIX} Using ${mode} executor`);
  }

  /**
   * Get the current execution mode.
   */
  get mode(): OutlookBackendMode {
    return this.executor.mode;
  }

  async getContacts(): Promise<Result<string, string>> {
    console.log(
      `${ContactImporterBackendOutlook.LOG_PREFIX} Exporting contacts via ${this.executor.mode} executor`
    );
    return this.executor.exportContacts();
  }

  /**
   * Test connectivity and DLL loading.
   */
  async ping(): Promise<Result<string, string>> {
    return this.executor.ping();
  }

  /**
   * Validate that all required dependencies can be loaded.
   */
  async validateDependencies(): Promise<Result<string, string>> {
    return this.executor.validateDependencies();
  }
}
