import { IBackendOutlookNativeExecutor, OutlookBackendMode } from './IBackendOutlookNativeExecutor';
import { BackendOutlookNativeExecutorCli } from './BackendOutlookNativeExecutorCLI';
import { BackendOutlookNativeExecutorEdge } from './BackendOutlookNativeExecutorEdge';

/**
 * Factory for creating Outlook native executors.
 *
 * Use this to switch between CLI and edge-based execution with a simple flag.
 * Default is 'cli' which works in all environments.
 */
export class OutlookNativeExecutorFactory {
  /**
   * Create an executor for the specified mode.
   *
   * @param mode 'cli' for process-based execution, 'edge' for in-process edge-js
   * @param comBridgePath Path to the outlookcombridge directory
   * @param useJsonForCli If true and mode is 'cli', use JSON output for debugging
   * @param dotnetPath Path to the .NET runtime installation directory (used by edge mode)
   */
  static create(
    mode: OutlookBackendMode,
    comBridgePath: string,
    useJsonForCli: boolean = false,
    dotnetPath: string = 'C:\\Program Files\\dotnet'
  ): IBackendOutlookNativeExecutor {
    switch (mode) {
      case 'cli':
        return new BackendOutlookNativeExecutorCli(comBridgePath, useJsonForCli);
      case 'edge':
        return new BackendOutlookNativeExecutorEdge(comBridgePath, dotnetPath);
      default:
        throw new Error(`Unknown backend mode: ${mode}`);
    }
  }

  /**
   * Determine the best available mode for the current environment.
   * Currently always returns 'cli' since Obsidian doesn't support native threads.
   * Will return 'edge' once native thread support is available.
   */
  static detectBestMode(): OutlookBackendMode {
    // TODO: Detect if native threads are available
    // For now, always use CLI since edge-js doesn't work in Obsidian renderer
    return 'cli';
  }
}
