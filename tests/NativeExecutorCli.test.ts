/**
 * Tests for NativeExecutorCli base class.
 * Tests core CLI execution, protobuf parsing, and error handling functionality.
 */

import { NativeExecutorCli } from '../src/pimbackend/NativeExecutorCli';
import { native_bridge } from '../src_generated/native_bridge';
import * as child_process from 'child_process';
import * as fs from 'fs';

// Mock modules
jest.mock('child_process');
jest.mock('fs');

/**
 * Helper to create a length-prefixed protobuf buffer.
 */
function createLengthPrefixedBuffer(response: native_bridge.ICliResponse): Buffer {
  const encoded = native_bridge.CliResponse.encode(response).finish();
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(encoded.length, 0);
  return Buffer.concat([lengthBuffer, encoded]);
}

/**
 * Helper to setup mock spawn with given response.
 */
function setupMockSpawn(buffer: Buffer) {
  const mockSpawn = jest.fn().mockReturnValue({
    stdout: {
      on: jest.fn((event, callback) => {
        if (event === 'data') callback(buffer);
      }),
    },
    stderr: { on: jest.fn() },
    on: jest.fn((event, callback) => {
      if (event === 'close') callback(0);
    }),
  });
  (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);
  return mockSpawn;
}

/**
 * Concrete implementation of NativeExecutorCli for testing.
 */
class TestNativeExecutorCli extends NativeExecutorCli {
  constructor(nativeBridgePath: string, useJson: boolean = false) {
    const exeName = process.platform === 'win32' ? 'TestBridge.exe' : 'TestBridge';
    super(nativeBridgePath, exeName, useJson);
  }

  /**
   * Expose executeCommand for testing.
   */
  public async testExecuteCommand(command: string, args: string[] = []) {
    return this.executeCommand(command, args);
  }

  /**
   * Expose executeCommandProtobuf for testing.
   */
  public async testExecuteCommandProtobuf(command: string, args: string[] = []) {
    return this.executeCommandProtobuf(command, args);
  }

  /**
   * Expose parseJsonResponse for testing.
   */
  public testParseJsonResponse<T>(buffer: Buffer): T {
    return this.parseJsonResponse<T>(buffer);
  }
}

describe('NativeExecutorCli', () => {
  const mockBridgePath = '/test/bridge';

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for fs.existsSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  describe('constructor', () => {
    it('should set correct exe name on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const executor = new TestNativeExecutorCli(mockBridgePath);

      // Restore platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });

      expect(executor.mode).toBe('cli');
    });

    it('should default useJson to false', () => {
      const executor = new TestNativeExecutorCli(mockBridgePath);
      expect(executor.mode).toBe('cli');
    });

    it('should accept useJson parameter', () => {
      const executor = new TestNativeExecutorCli(mockBridgePath, true);
      expect(executor.mode).toBe('cli');
    });
  });

  describe('executeCommand', () => {
    it('should return error when CLI tool not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommand('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('CLI tool not found');
    });

    it('should spawn CLI tool with correct arguments', async () => {
      const buffer = Buffer.from('test output');
      const mockSpawn = setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommand('test-cmd', ['arg1', 'arg2']);

      expect(result.isOk()).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['test-cmd', 'arg1', 'arg2'],
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: mockBridgePath,
        })
      );
    });

    it('should include --json flag when useJson is true', async () => {
      const buffer = Buffer.from('{}');
      const mockSpawn = setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath, true);
      await executor.testExecuteCommand('test-cmd');

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--json']),
        expect.any(Object)
      );
    });

    it('should return collected stdout data', async () => {
      const expectedData = Buffer.from('test output data');
      const mockSpawn = setupMockSpawn(expectedData);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommand('test-cmd');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(expectedData);
    });

    it('should handle multiple stdout chunks', async () => {
      const chunk1 = Buffer.from('part1');
      const chunk2 = Buffer.from('part2');
      const chunk3 = Buffer.from('part3');

      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(chunk1);
              callback(chunk2);
              callback(chunk3);
            }
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommand('test-cmd');

      expect(result.isOk()).toBe(true);
      const buffer = result.unwrap();
      expect(buffer.toString()).toBe('part1part2part3');
    });
  });

  describe('error handling', () => {
    it('should handle CLI spawn error', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Failed to start process'));
          }
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommand('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to start process');
    });

    it('should handle non-zero exit code', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: {
          on: jest.fn((event, callback) => {
            if (event === 'data') callback(Buffer.from('Unhandled exception occurred'));
          }),
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(1);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommand('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Unhandled exception');
    });

    it('should handle empty output', async () => {
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommand('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('no output');
    });

    it('should capture stderr when exit code is non-zero', async () => {
      const stderrMessage = 'Critical error in native code';
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: {
          on: jest.fn((event, callback) => {
            if (event === 'data') callback(Buffer.from(stderrMessage));
          }),
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(2);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommand('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(stderrMessage);
    });
  });

  describe('protobuf parsing', () => {
    it('should parse length-prefixed binary protobuf correctly', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'test-echo',
        timestamp: Date.now(),
        exportResult: {
          echo: 'Hello World',
        },
      };
      const buffer = createLengthPrefixedBuffer(response);
      setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommandProtobuf('test-echo');

      expect(result.isOk()).toBe(true);
      const cliResponse = result.unwrap();
      expect(cliResponse.success).toBe(true);
      expect(cliResponse.command).toBe('test-echo');
      expect(cliResponse.exportResult?.echo).toBe('Hello World');
    });

    it('should handle corrupted protobuf response', async () => {
      // Create invalid protobuf data
      const corruptedBuffer = Buffer.from([0x10, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff]);

      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') callback(corruptedBuffer);
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommandProtobuf('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to parse');
    });

    it('should handle buffer too short for length prefix', async () => {
      const tooShortBuffer = Buffer.from([0x10, 0x00]); // Only 2 bytes, need 4

      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') callback(tooShortBuffer);
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommandProtobuf('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to parse');
    });

    it('should handle incomplete protobuf payload', async () => {
      // Create a length prefix that says payload is 100 bytes, but only provide 10
      const incompleteBuffer = Buffer.alloc(14);
      incompleteBuffer.writeUInt32LE(100, 0); // Says 100 bytes follow
      // But buffer is only 14 bytes total (4 + 10)

      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') callback(incompleteBuffer);
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.testExecuteCommandProtobuf('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to parse');
    });
  });

  describe('JSON mode', () => {
    it('should parse JSON response correctly', async () => {
      const jsonResponse = {
        success: true,
        command: 'test-echo',
        timestamp: Date.now(),
        exportResult: {
          echo: 'Hello from JSON',
        },
      };
      const jsonBuffer = Buffer.from(JSON.stringify(jsonResponse));

      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') callback(jsonBuffer);
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath, true);
      const result = await executor.testExecuteCommandProtobuf('test-echo');

      expect(result.isOk()).toBe(true);
      const cliResponse = result.unwrap();
      expect(cliResponse.success).toBe(true);
      expect(cliResponse.command).toBe('test-echo');
      expect(cliResponse.exportResult?.echo).toBe('Hello from JSON');
    });

    it('should include --json flag in command args', async () => {
      const jsonResponse = { success: true, command: 'test', timestamp: Date.now() };
      const jsonBuffer = Buffer.from(JSON.stringify(jsonResponse));

      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') callback(jsonBuffer);
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath, true);
      await executor.testExecuteCommandProtobuf('test-cmd', ['arg1']);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['test-cmd', 'arg1', '--json'],
        expect.any(Object)
      );
    });

    it('should handle invalid JSON', async () => {
      const invalidJson = Buffer.from('{ invalid json }');

      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') callback(invalidJson);
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new TestNativeExecutorCli(mockBridgePath, true);
      const result = await executor.testExecuteCommandProtobuf('test-cmd');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to parse');
    });
  });

  describe('ping', () => {
    it('should return pong on success', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'ping',
        timestamp: Date.now(),
        simpleResult: 'pong',
      };
      const buffer = createLengthPrefixedBuffer(response);
      setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.ping();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('pong');
    });

    it('should return error when ping fails', async () => {
      const response: native_bridge.ICliResponse = {
        success: false,
        command: 'ping',
        timestamp: Date.now(),
        errorMessage: 'Ping timeout',
      };
      const buffer = createLengthPrefixedBuffer(response);
      setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.ping();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('Ping timeout');
    });

    it('should handle missing simpleResult field', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'ping',
        timestamp: Date.now(),
        // simpleResult omitted
      };
      const buffer = createLengthPrefixedBuffer(response);
      setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.ping();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('pong'); // Default fallback
    });
  });

  describe('validateDependencies', () => {
    it('should return success message on validation success', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'validate-deps',
        timestamp: Date.now(),
        simpleResult: 'All dependencies validated successfully',
      };
      const buffer = createLengthPrefixedBuffer(response);
      setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.validateDependencies();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toContain('dependencies validated');
    });

    it('should return error when validation fails', async () => {
      const response: native_bridge.ICliResponse = {
        success: false,
        command: 'validate-deps',
        timestamp: Date.now(),
        errorMessage: 'Missing required DLL: Microsoft.Office.Interop.Outlook.dll',
      };
      const buffer = createLengthPrefixedBuffer(response);
      setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.validateDependencies();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Missing required DLL');
    });

    it('should handle missing simpleResult field', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'validate-deps',
        timestamp: Date.now(),
        // simpleResult omitted
      };
      const buffer = createLengthPrefixedBuffer(response);
      setupMockSpawn(buffer);

      const executor = new TestNativeExecutorCli(mockBridgePath);
      const result = await executor.validateDependencies();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toContain('All dependencies validated'); // Default fallback
    });
  });
});
