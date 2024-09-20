import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Err, Ok, Result } from 'oxide.ts';
import { INativeExecutor, NativeExecutionMode } from './INativeExecutor';
import { native_bridge } from '../../src_generated/native_bridge';

/**
 * Base class for CLI-based native code execution.
 * Spawns a CLI tool as a child process and communicates via stdin/stdout.
 *
 * This approach:
 * - Works in all environments (no native thread requirements)
 * - Avoids renderer origin security issues
 * - Keeps the executable minimal
 * - Supports both binary protobuf and JSON output
 *
 * Includes protobuf parsing for native_bridge.CliResponse protocol.
 * Subclasses should implement specific command execution and response parsing.
 */
export abstract class NativeExecutorCli implements INativeExecutor {
  readonly mode: NativeExecutionMode = 'cli';

  protected readonly nativeBridgePath: string;
  protected readonly exePath: string;
  protected readonly useJson: boolean;
  protected readonly useTestData: boolean;

  /**
   * @param nativeBridgePath Path to the directory containing the CLI tool.
   * @param exeName Name of the executable file (e.g., 'OutlookComBridge.exe').
   * @param useJson If true, use JSON output for human-readable debugging. Default: false (binary).
   * @param useTestData If true, use --test-data flag to get synthetic test data. Default: false.
   */
  constructor(
    nativeBridgePath: string,
    exeName: string,
    useJson: boolean = false,
    useTestData: boolean = false
  ) {
    this.nativeBridgePath = nativeBridgePath;
    this.useJson = useJson;
    this.useTestData = useTestData;
    this.exePath = path.join(nativeBridgePath, exeName);
  }

  /**
   * Execute a command with the CLI tool.
   *
   * @param command The command name to execute.
   * @param args Additional command arguments.
   * @returns Promise resolving to raw output buffer or error.
   */
  protected async executeCommand(
    command: string,
    args: string[] = []
  ): Promise<Result<Buffer, string>> {
    if (!fs.existsSync(this.exePath)) {
      return Err(`CLI tool not found at: ${this.exePath}`);
    }

    const cliArgs = [command, ...args];
    if (this.useJson) {
      cliArgs.push('--json');
    }
    if (this.useTestData) {
      cliArgs.push('--test-data');
    }

    return new Promise((resolve) => {
      const child: ChildProcess = spawn(this.exePath, cliArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.nativeBridgePath,
      });

      const chunks: Buffer[] = [];
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        chunks.push(data);
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        resolve(Err(`Failed to spawn CLI tool: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          resolve(Err(stderr || `CLI exited with code ${code}`));
          return;
        }

        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          resolve(Err(stderr || 'CLI produced no output'));
          return;
        }

        resolve(Ok(buffer));
      });
    });
  }

  /**
   * Parse JSON response from CLI output.
   * @param buffer Raw stdout buffer from CLI.
   */
  protected parseJsonResponse<T>(buffer: Buffer): T {
    const json = JSON.parse(buffer.toString('utf8'));
    return json as T;
  }

  /**
   * Execute a command and parse the response as a CliResponse protobuf.
   *
   * @param command The command name to execute.
   * @param args Additional command arguments.
   * @returns Promise resolving to parsed CliResponse or error.
   */
  protected async executeCommandProtobuf(
    command: string,
    args: string[] = []
  ): Promise<Result<native_bridge.CliResponse, string>> {
    const result = await this.executeCommand(command, args);
    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    try {
      const buffer = result.unwrap();
      let response: native_bridge.CliResponse;

      if (this.useJson) {
        const json = this.parseJsonResponse<any>(buffer);
        response = native_bridge.CliResponse.fromObject(json);
      } else {
        response = this.parseLengthPrefixedResponse(buffer);
      }

      return Ok(response);
    } catch (parseErr) {
      return Err(`Failed to parse CLI response: ${parseErr}`);
    }
  }

  /**
   * Parse length-prefixed binary protobuf response.
   * Protocol: 4-byte little-endian uint32 length prefix + protobuf payload.
   */
  private parseLengthPrefixedResponse(buffer: Buffer): native_bridge.CliResponse {
    if (buffer.length < 4) {
      throw new Error(`Buffer too short: expected at least 4 bytes, got ${buffer.length}`);
    }

    const length = buffer.readUInt32LE(0);
    const expectedTotal = 4 + length;

    if (buffer.length < expectedTotal) {
      throw new Error(`Buffer incomplete: expected ${expectedTotal} bytes, got ${buffer.length}`);
    }

    const payload = buffer.subarray(4, expectedTotal);
    return native_bridge.CliResponse.decode(payload);
  }

  async ping(): Promise<Result<string, string>> {
    const result = await this.executeCommandProtobuf('ping');
    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    const response = result.unwrap();
    if (!response.success) {
      return Err(response.errorMessage || 'Ping failed');
    }

    return Ok(response.simpleResult || 'pong');
  }

  async validateDependencies(): Promise<Result<string, string>> {
    const result = await this.executeCommandProtobuf('--validate-deps');
    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    const response = result.unwrap();
    if (!response.success) {
      return Err(response.errorMessage || 'Validation failed');
    }

    return Ok(response.simpleResult || 'All dependencies validated successfully');
  }
}
