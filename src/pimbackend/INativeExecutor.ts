import { Result } from 'oxide.ts';

/**
 * Execution mode for native operations.
 *
 * - 'cli': Spawn a CLI tool as a child process.
 *          Works in all environments, avoids threading issues.
 *
 * - 'edge': Use electron-edge-js to call .NET DLLs directly in-process.
 *           More efficient but requires native thread support.
 */
export type NativeExecutionMode = 'cli' | 'edge';

/**
 * Generic interface for executing native code operations.
 * Implementations can use either CLI process or edge-js based on mode.
 *
 * This interface defines the contract for any native executor, regardless
 * of the specific backend (Outlook, etc.).
 */
export interface INativeExecutor {
  /**
   * The execution mode this executor uses.
   */
  readonly mode: NativeExecutionMode;

  /**
   * Test connectivity and verify the native code can be loaded.
   * @returns Promise resolving to success message or error.
   */
  ping(): Promise<Result<string, string>>;

  /**
   * Validate that all required dependencies can be loaded.
   * @returns Promise resolving to validation message or error.
   */
  validateDependencies(): Promise<Result<string, string>>;
}
