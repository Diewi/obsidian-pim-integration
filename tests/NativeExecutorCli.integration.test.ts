/**
 * Integration tests for NativeExecutorCli base class.
 *s
 * These tests focus on the test-echo command to validate protobuf encoding/decoding.
 * NO MOCKS - this file tests real CLI interaction.
 *
 * Prerequisites:
 * - OutlookComBridge.exe must exist in dist_outlookcombridge/
 * - Build the CLI tool first: cd src_native/outlookcombridge && dotnet build --configuration Release
 *
 * The tests create a temporary directory and use BackendOutlookDepsJsonGenerator
 * to generate properly patched deps.json and runtimeconfig.json files.
 */

import { NativeExecutorCli } from '../src/pimbackend/NativeExecutorCli';
import { BackendOutlookDepsJsonGenerator } from '../src/pimbackend/outlook/BackendOutlookDepsJsonGenerator';
import { BackendVariantOutlook15Plus } from '../src/pimbackend/outlook/BackendVariantOutlook15Plus';
import { DEFAULT_DOTNET_PATH } from '../src/settings';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describeWindows } from './testUtils';

// NO jest.mock() calls - we want real modules

/**
 * Test subclass that exposes protected methods for integration testing.
 */
class TestNativeExecutorCli extends NativeExecutorCli {
  constructor(nativeBridgePath: string, useJson: boolean = false, useTestData: boolean = false) {
    const exeName = process.platform === 'win32' ? 'OutlookComBridge.exe' : 'OutlookComBridge';
    super(nativeBridgePath, exeName, useJson, useTestData);
  }

  /**
   * Expose executeCommandProtobuf for testing.
   */
  public async testExecuteCommandProtobuf(command: string, args: string[] = []) {
    return this.executeCommandProtobuf(command, args);
  }
}

describeWindows('NativeExecutorCli Integration Tests', () => {
  const sourceCliBridgePath = path.resolve(__dirname, '../dist_outlookcombridge');

  let tempTestDir: string | null = null;
  let comBridgePath: string | null = null;

  beforeAll(() => {
    // Check if source CLI tool exists
    const exeName = process.platform === 'win32' ? 'OutlookComBridge.exe' : 'OutlookComBridge';
    const sourceExePath = path.join(sourceCliBridgePath, exeName);

    if (!fs.existsSync(sourceExePath)) {
      console.warn('⚠️  CLI tool not found. Integration tests will be skipped.');
      console.warn(
        '   Build: cd src_native/outlookcombridge && dotnet build --configuration Release'
      );
      console.warn('   And copy OutlookComBridge.exe to dist_outlookcombridge/');
      return;
    }

    // Create temporary test directory
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-executor-cli-integration-'));
    console.log(`✓ Created temp test directory: ${tempTestDir}`);

    // Copy CLI tool files to temp directory
    const filesToCopy = [
      'OutlookComBridge.exe',
      'OutlookComBridge.dll',
      'OutlookComBridge.pdb',
      'OutlookComBridge.deps.json',
      'OutlookComBridge.runtimeconfig.json',
      'Google.Protobuf.dll',
      'Microsoft.Extensions.DependencyModel.dll',
      'Microsoft.Office.Interop.Outlook.dll',
      'Mono.Options.dll',
      'Office.dll',
    ];

    for (const file of filesToCopy) {
      const src = path.join(sourceCliBridgePath, file);
      const dest = path.join(tempTestDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
    console.log(`✓ Copied CLI files to temp directory`);

    // Generate patched deps.json and runtimeconfig.json
    const backendVariant = new BackendVariantOutlook15Plus();
    const assemblyDescriptors = [
      backendVariant.getOfficeDllDescriptor(),
      backendVariant.getOfficeInteropDllDescriptor(),
    ];

    const generator = new BackendOutlookDepsJsonGenerator(
      tempTestDir,
      tempTestDir,
      'OutlookComBridge.deps.json',
      'OutlookComBridge.runtimeconfig.json',
      assemblyDescriptors,
      DEFAULT_DOTNET_PATH
    );

    const generateResult = generator.generate();
    if (generateResult.isErr()) {
      console.error(`Failed to generate deps.json: ${generateResult.unwrapErr()}`);
      if (tempTestDir && fs.existsSync(tempTestDir)) {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
      }
      tempTestDir = null;
      return;
    }

    console.log(`✓ Generated patched deps.json and runtimeconfig.json`);
    comBridgePath = tempTestDir;
  });

  afterAll(() => {
    if (tempTestDir && fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
      console.log(`✓ Cleaned up temp test directory`);
    }
  });

  describe('test-echo command', () => {
    it('should execute ping command with real CLI', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new TestNativeExecutorCli(comBridgePath, false, false);

      const result = await executor.ping();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('pong');

      console.log('✓ Ping command successful');
    }, 10000);

    it('should execute test-echo with --test-data flag (protobuf mode)', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new TestNativeExecutorCli(comBridgePath, false, true);

      const result = await executor.testExecuteCommandProtobuf('test-echo');

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();

      expect(response.success).toBe(true);
      expect(response.command).toBe('test-echo');
      expect(response.exportResult).toBeDefined();
      expect(response.exportResult?.echo).toBe('Hello from test data!');

      console.log(`✓ Received echo: "${response.exportResult?.echo}"`);
    }, 10000);

    it('should execute test-echo with --test-data flag (JSON mode)', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new TestNativeExecutorCli(comBridgePath, true, true);

      const result = await executor.testExecuteCommandProtobuf('test-echo');

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();

      expect(response.success).toBe(true);
      expect(response.exportResult?.echo).toBe('Hello from test data!');

      console.log('✓ JSON mode test-echo works correctly');
    }, 10000);

    it('should execute test-echo without --test-data flag', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new TestNativeExecutorCli(comBridgePath, false, false);

      const result = await executor.testExecuteCommandProtobuf('test-echo');

      expect(result.isOk()).toBe(true);
      const response = result.unwrap();

      expect(response.success).toBe(true);
      expect(response.exportResult?.echo).toBeDefined();
      expect(response.exportResult?.echo).toBe('Hello World from OutlookComBridge!');

      console.log(`✓ Echo without test data: "${response.exportResult?.echo}"`);
    }, 10000);

    it('should handle length-prefixed protobuf responses correctly', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new TestNativeExecutorCli(comBridgePath, false, true);

      // Execute multiple commands to verify protobuf parsing is consistent
      const pingResult = await executor.ping();
      const echoResult = await executor.testExecuteCommandProtobuf('test-echo');

      expect(pingResult.isOk()).toBe(true);
      expect(echoResult.isOk()).toBe(true);

      const echoResponse = echoResult.unwrap();
      expect(echoResponse.exportResult?.echo).toBe('Hello from test data!');

      console.log('✓ Length-prefixed protobuf decoding verified across multiple commands');
    }, 10000);

    it('should handle CLI tool not found gracefully', async () => {
      const nonExistentPath = path.resolve(__dirname, '../nonexistent');
      const executor = new TestNativeExecutorCli(nonExistentPath, false, false);

      const result = await executor.ping();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('CLI tool not found');

      console.log('✓ Gracefully handled missing CLI tool');
    }, 10000);

    it('should return consistent data between protobuf and JSON modes', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      // Test protobuf mode
      const protobufExecutor = new TestNativeExecutorCli(comBridgePath, false, true);
      const protobufResult = await protobufExecutor.testExecuteCommandProtobuf('test-echo');

      // Test JSON mode
      const jsonExecutor = new TestNativeExecutorCli(comBridgePath, true, true);
      const jsonResult = await jsonExecutor.testExecuteCommandProtobuf('test-echo');

      expect(protobufResult.isOk()).toBe(true);
      expect(jsonResult.isOk()).toBe(true);

      const protobufEcho = protobufResult.unwrap().exportResult?.echo;
      const jsonEcho = jsonResult.unwrap().exportResult?.echo;

      // Both should return the same data
      expect(protobufEcho).toBe(jsonEcho);
      expect(protobufEcho).toBe('Hello from test data!');

      console.log('✓ Protobuf and JSON modes return consistent data');
    }, 10000);
  });
});
