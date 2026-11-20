import { IBackendOutlookNativeExecutor, OutlookBackendMode } from './IBackendOutlookNativeExecutor';
import { BackendOutlookNativeExecutorCli } from './BackendOutlookNativeExecutorCLI';
import { BackendOutlookNativeExecutorEdge } from './BackendOutlookNativeExecutorEdge';

/**
 * Set by esbuild (`define`) to true when the plugin is built with `--edge`, which also copies the
 * electron-edge-js files the edge mode needs into dist/outlookcombridge. Undefined in tests and
 * in builds without `--edge`.
 */
declare const __PIM_EDGE_MODE__: boolean | undefined;

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
   * Determine the execution mode for this build.
   * Returns 'cli' unless the plugin was built with `--edge` (see esbuild.config.mjs). Only the
   * edge build ships electron-edge-js, and edge mode does not work in the Obsidian renderer yet
   * (no native threads), so the edge build is for experiments only.
   */
  static detectBestMode(): OutlookBackendMode {
    // TODO: Detect if native threads are available
    return typeof __PIM_EDGE_MODE__ !== 'undefined' && __PIM_EDGE_MODE__ ? 'edge' : 'cli';
  }
}
