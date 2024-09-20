import * as path from 'path';
import * as fs from 'fs';
import { Err, Ok, Result } from 'oxide.ts';
import { INativeExecutor, NativeExecutionMode } from './INativeExecutor';

/**
 * Base class for edge-js-based native code execution.
 * Uses electron-edge-js to call .NET DLLs directly in-process.
 *
 * This approach:
 * - More efficient (no process spawn overhead)
 * - Requires native thread support
 * - Only works when native threads are available
 *
 * Subclasses should implement specific .NET method wrappers.
 */
export abstract class NativeExecutorEdge implements INativeExecutor {
  readonly mode: NativeExecutionMode = 'edge';

  protected readonly nativeBridgePath: string;
  protected readonly dotnetPath: string;
  protected edgeModule: any;
  protected isLoaded: boolean = false;

  private static readonly LOG_PREFIX = '[electron-edge-js]';

  constructor(nativeBridgePath: string, dotnetPath: string = 'C:\\Program Files\\dotnet') {
    this.nativeBridgePath = nativeBridgePath;
    this.dotnetPath = dotnetPath;
  }

  /**
   * Ensure the edge module is loaded.
   * Subclasses should call this before attempting to execute any .NET methods.
   */
  protected async ensureEdgeLoaded(): Promise<Result<void, string>> {
    if (this.isLoaded) {
      return Ok(undefined);
    }

    const loadResult = this.loadEdge();
    if (loadResult.isErr()) {
      return loadResult;
    }

    this.isLoaded = true;
    this.dumpDebugInfo('Edge-js module loaded successfully', {
      edgeUseCoreclr: process.env.EDGE_USE_CORECLR,
    });

    return Ok(undefined);
  }

  /**
   * Load the edge-js module and configure environment.
   */
  private loadEdge(): Result<void, string> {
    // Configure environment needed by electron-edge-js / edge-js
    process.env.EDGE_USE_CORECLR = '1';
    process.env.EDGE_DEBUG = '1';
    process.env.COREHOST_TRACE = '1';
    process.env.EDGE_APP_ROOT = this.nativeBridgePath;
    process.env.EDGE_USE_RUNTIME_CONFIG = '1';

    if (!process.env.DOTNET_ROOT) {
      const dotnetPath = this.dotnetPath;
      if (fs.existsSync(dotnetPath)) {
        process.env.DOTNET_ROOT = dotnetPath;
      }
    }

    // Prefer electron-edge-js inside the provided nativeBridgePath, fallback to edge-js
    const candidates = [
      path.join(this.nativeBridgePath, 'electron-edge-js', 'lib', 'edge.js'),
      path.join(this.nativeBridgePath, 'edge-js', 'lib', 'edge.js'),
    ];

    let edgeJsPath: string | undefined;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        edgeJsPath = p;
        break;
      }
    }

    if (!edgeJsPath) {
      return Err('Could not locate edge.js under nativeBridgePath');
    }

    try {
      const edgeModule = require(edgeJsPath);
      if (!edgeModule || !edgeModule.func) {
        return Err('EdgeJS module did not load correctly from path: ' + edgeJsPath);
      }
      this.edgeModule = edgeModule;
    } catch (error) {
      this.logErrorDetails(error);
      return Err(`Failed to require edge-js module at path ${edgeJsPath}: ${String(error)}`);
    }
    return Ok(undefined);
  }

  /**
   * Get the edge module for creating .NET function bindings.
   */
  protected getEdgeModule(): any {
    return this.edgeModule;
  }

  /**
   * Check if a DLL file exists at the expected path.
   */
  protected dllExists(dllName: string): boolean {
    const dllPath = path.join(this.nativeBridgePath, dllName);
    return fs.existsSync(dllPath);
  }

  /**
   * Get the full path to a DLL file.
   */
  protected getDllPath(dllName: string): string {
    return path.join(this.nativeBridgePath, dllName);
  }

  private dumpDebugInfo(message: string, details?: Record<string, any>): void {
    console.log(NativeExecutorEdge.LOG_PREFIX, message);
    if (details) {
      for (const [key, value] of Object.entries(details)) {
        console.log(`  ${key}:`, value);
      }
    }
  }

  private logErrorDetails(error: any): void {
    console.error(NativeExecutorEdge.LOG_PREFIX, 'Error type:', typeof error);
    console.error(NativeExecutorEdge.LOG_PREFIX, 'Error message:', error?.message);
    console.error(NativeExecutorEdge.LOG_PREFIX, 'Error stack:', error?.stack);
    try {
      console.error(
        NativeExecutorEdge.LOG_PREFIX,
        'Error details:',
        JSON.stringify(error, null, 2)
      );
    } catch (e) {
      console.error(NativeExecutorEdge.LOG_PREFIX, 'Could not stringify error');
    }
  }

  async ping(): Promise<Result<string, string>> {
    const loadResult = await this.ensureEdgeLoaded();
    if (loadResult.isErr()) {
      return Err(loadResult.unwrapErr());
    }
    return Ok('pong');
  }

  async validateDependencies(): Promise<Result<string, string>> {
    const loadResult = await this.ensureEdgeLoaded();
    if (loadResult.isErr()) {
      return Err(loadResult.unwrapErr());
    }
    return Ok('Edge module loaded successfully');
  }
}
