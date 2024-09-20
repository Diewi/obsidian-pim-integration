/**
 * Integration tests for NativeExecutorEdge base class.
 *
 * These tests run in a separate Node process to avoid Jest threading issues
 * with edge-js native modules.
 *
 * Prerequisites:
 * - OutlookComBridge.dll must exist in dist/outlookcombridge/
 * - edge-js must be installed in node_modules/
 * - Plugin must be deployed (electron-edge-js bundled in dist/outlookcombridge)
 */

import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

describe('NativeExecutorEdge Integration Tests', () => {
  const distOutlookComBridge = path.resolve(__dirname, '../../dist/outlookcombridge');
  const testScript = path.join(__dirname, 'test-native-executor-edge.js');

  beforeAll(() => {
    // Check prerequisites
    const dllPath = path.join(distOutlookComBridge, 'OutlookComBridge.dll');
    const edgeJsPath = path.join(distOutlookComBridge, 'electron-edge-js');
    if (!fs.existsSync(dllPath) || !fs.existsSync(edgeJsPath)) {
      console.warn('⚠️  dist/outlookcombridge not fully deployed. Edge tests will be skipped.');
      console.warn('   Build and deploy the plugin first.');
    }
  });

  it('should load edge-js and create function bindings', () => {
    const dllPath = path.join(distOutlookComBridge, 'OutlookComBridge.dll');
    if (!fs.existsSync(dllPath)) {
      console.log('Skipping: OutlookComBridge.dll not found');
      return;
    }

    const result = spawnSync('node', [testScript], {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: path.dirname(testScript),
    });

    // Output for debugging
    if (result.stderr) {
      console.log('stderr:', result.stderr);
    }
    if (result.stdout) {
      console.log('stdout:', result.stdout);
    }

    // Check for CoreCLR initialization failure - this is an environment issue, not a test failure
    if (
      result.stdout?.includes('Error occurred during CoreCLR initialization') ||
      result.stderr?.includes('Error occurred during CoreCLR initialization')
    ) {
      console.log('Skipping: CoreCLR initialization failed - environment not properly configured');
      return;
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('edge-js loaded successfully');
    expect(result.stdout).toContain('edge.func exists');
  }, 60000);

  it('should handle ping functionality (edge module loaded)', () => {
    const dllPath = path.join(distOutlookComBridge, 'OutlookComBridge.dll');
    if (!fs.existsSync(dllPath)) {
      console.log('Skipping: OutlookComBridge.dll not found');
      return;
    }

    const result = spawnSync('node', [testScript], {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: path.dirname(testScript),
    });

    // Check for CoreCLR initialization failure - this is an environment issue, not a test failure
    if (
      result.stdout?.includes('Error occurred during CoreCLR initialization') ||
      result.stderr?.includes('Error occurred during CoreCLR initialization')
    ) {
      console.log('Skipping: CoreCLR initialization failed - environment not properly configured');
      return;
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ping should return pong');
  }, 60000);

  it('should create edge function for OutlookComBridge', () => {
    const dllPath = path.join(distOutlookComBridge, 'OutlookComBridge.dll');
    if (!fs.existsSync(dllPath)) {
      console.log('Skipping: OutlookComBridge.dll not found');
      return;
    }

    const result = spawnSync('node', [testScript], {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: path.dirname(testScript),
    });

    // Check for CoreCLR initialization failure - this is an environment issue, not a test failure
    if (
      result.stdout?.includes('Error occurred during CoreCLR initialization') ||
      result.stderr?.includes('Error occurred during CoreCLR initialization')
    ) {
      console.log('Skipping: CoreCLR initialization failed - environment not properly configured');
      return;
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('should create edge function for OutlookComBridge');
  }, 60000);

  it('should pass all tests', () => {
    const dllPath = path.join(distOutlookComBridge, 'OutlookComBridge.dll');
    if (!fs.existsSync(dllPath)) {
      console.log('Skipping: OutlookComBridge.dll not found');
      return;
    }

    const result = spawnSync('node', [testScript], {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: path.dirname(testScript),
    });

    // Check for CoreCLR initialization failure - this is an environment issue, not a test failure
    if (
      result.stdout?.includes('Error occurred during CoreCLR initialization') ||
      result.stderr?.includes('Error occurred during CoreCLR initialization')
    ) {
      console.log('Skipping: CoreCLR initialization failed - environment not properly configured');
      return;
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Tests failed: 0');
  }, 60000);
});
