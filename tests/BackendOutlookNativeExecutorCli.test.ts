/**
 * Tests for BackendOutlookNativeExecutorCli.
 *
 * Tests Outlook-specific CLI functionality:
 * - Contact export methods (exportContacts, exportContactsAsVCards)
 * - vCard data extraction logic (merged vs individual vCards)
 * - Integration with OutlookComBridge CLI using --test-data flag
 *
 * Note: Basic CLI execution, error handling, and protobuf parsing are tested in NativeExecutorCli.test.ts
 */

import { BackendOutlookNativeExecutorCli } from '../src/pimbackend/outlook/BackendOutlookNativeExecutorCLI';
import { native_bridge } from '../src_generated/native_bridge';
import { describeWindows } from './testUtils';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock modules only for unit tests (not integration tests)
jest.mock('child_process');
jest.mock('fs');

// Test data constants matching C# TestData class
const JOHN_DOE_VCARD = `BEGIN:VCARD
VERSION:3.0
N:Doe;John;;;
FN:John Doe
ORG:Test Company Inc.
TITLE:Software Engineer
TEL;TYPE=WORK,VOICE:+1-555-123-4567
TEL;TYPE=CELL:+1-555-987-6543
EMAIL;TYPE=WORK:john.doe@testcompany.com
ADR;TYPE=WORK:;;123 Business Ave;Springfield;IL;62701;USA
NOTE:This is a test contact for integration testing purposes.
END:VCARD`;

const JANE_SMITH_VCARD = `BEGIN:VCARD
VERSION:3.0
N:Smith;Jane;;;
FN:Jane Smith
ORG:Another Company LLC
TITLE:Project Manager
TEL;TYPE=WORK,VOICE:+1-555-222-3333
EMAIL;TYPE=WORK:jane.smith@anothercompany.com
ADR;TYPE=WORK:;;789 Corporate Blvd;Chicago;IL;60601;USA
END:VCARD`;

const BOB_JOHNSON_VCARD = `BEGIN:VCARD
VERSION:3.0
N:Johnson;Bob;;;
FN:Bob Johnson
ORG:Tech Startup
TITLE:CTO
TEL;TYPE=WORK,VOICE:+1-555-777-8888
EMAIL;TYPE=WORK:bob.j@techstartup.com
END:VCARD`;

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
 * Helper to setup mock spawn with CLI response.
 */
function setupMockCli(response: native_bridge.ICliResponse) {
  const buffer = createLengthPrefixedBuffer(response);
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
 * Create a successful export response with test data.
 */
function createTestDataResponse(vcards: string[], merged?: string): native_bridge.ICliResponse {
  return {
    success: true,
    command: 'export-contacts',
    timestamp: Date.now(),
    exportResult: merged ? { mergedVcards: merged } : { vcards: { vcards } },
  };
}

describe('BackendOutlookNativeExecutorCli', () => {
  const mockComBridgePath = '/test/outlookcombridge';

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  describe('exportContacts', () => {
    it('should export merged vCards from CLI with test data', async () => {
      const mergedVcards = `${JOHN_DOE_VCARD}\n${JANE_SMITH_VCARD}\n${BOB_JOHNSON_VCARD}`;
      const response = createTestDataResponse([], mergedVcards);
      const mockSpawn = setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContacts();

      expect(result.isOk()).toBe(true);
      const vcard = result.unwrap();

      // Verify all three test contacts are present
      expect(vcard).toContain('FN:John Doe');
      expect(vcard).toContain('FN:Jane Smith');
      expect(vcard).toContain('FN:Bob Johnson');

      // Verify CLI was called with correct command
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('OutlookComBridge'),
        ['export-contacts'],
        expect.objectContaining({ cwd: mockComBridgePath })
      );
    });

    it('should export and concatenate individual vCards when merged not available', async () => {
      const vcards = [JOHN_DOE_VCARD, JANE_SMITH_VCARD];
      const response = createTestDataResponse(vcards);
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContacts();

      expect(result.isOk()).toBe(true);
      const merged = result.unwrap();

      // Should be concatenated with newline
      expect(merged).toBe(vcards.join('\n'));
      expect(merged).toContain('John Doe');
      expect(merged).toContain('Jane Smith');
    });

    it('should prefer merged vCards over individual vCards when both present', async () => {
      const mergedVcards = 'MERGED_VERSION';
      const individualVcards = ['INDIVIDUAL_1', 'INDIVIDUAL_2'];

      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'export-contacts',
        timestamp: Date.now(),
        exportResult: {
          mergedVcards: mergedVcards,
          vcards: { vcards: individualVcards },
        },
      };
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContacts();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('MERGED_VERSION');
    });

    it('should return empty string when no vCard data available', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'export-contacts',
        timestamp: Date.now(),
        exportResult: {},
      };
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContacts();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('');
    });

    it('should return error when CLI reports failure', async () => {
      const response: native_bridge.ICliResponse = {
        success: false,
        command: 'export-contacts',
        errorMessage: 'Outlook not running',
        timestamp: Date.now(),
      };
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContacts();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('Outlook not running');
    });

    it('should return error when export result is missing', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'export-contacts',
        timestamp: Date.now(),
        // exportResult intentionally omitted
      };
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContacts();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('No export result returned');
    });
  });

  describe('exportContactsAsVCards', () => {
    it('should return array of individual vCards from CLI test data', async () => {
      const vcards = [JOHN_DOE_VCARD, JANE_SMITH_VCARD, BOB_JOHNSON_VCARD];
      const response = createTestDataResponse(vcards);
      const mockSpawn = setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContactsAsVCards();

      expect(result.isOk()).toBe(true);
      const resultVcards = result.unwrap();

      // Verify array structure
      expect(resultVcards).toHaveLength(3);

      // Verify individual vCard content
      expect(resultVcards[0]).toContain('FN:John Doe');
      expect(resultVcards[0]).toContain('ORG:Test Company Inc.');
      expect(resultVcards[1]).toContain('FN:Jane Smith');
      expect(resultVcards[1]).toContain('ORG:Another Company LLC');
      expect(resultVcards[2]).toContain('FN:Bob Johnson');
      expect(resultVcards[2]).toContain('ORG:Tech Startup');

      // Verify CLI was called correctly
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('OutlookComBridge'),
        ['export-contacts'],
        expect.any(Object)
      );
    });

    it('should handle complex vCard data with multiple fields', async () => {
      const complexVcard = JOHN_DOE_VCARD; // Already has multiple phone, email, address fields
      const response = createTestDataResponse([complexVcard]);
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContactsAsVCards();

      expect(result.isOk()).toBe(true);
      const vcards = result.unwrap();

      expect(vcards).toHaveLength(1);
      const vcard = vcards[0];

      // Verify multi-value fields are preserved
      expect(vcard).toContain('TEL;TYPE=WORK,VOICE:+1-555-123-4567');
      expect(vcard).toContain('TEL;TYPE=CELL:+1-555-987-6543');
      expect(vcard).toContain('EMAIL;TYPE=WORK:john.doe@testcompany.com');
      expect(vcard).toContain('ADR;TYPE=WORK:;;123 Business Ave;Springfield;IL;62701;USA');
      expect(vcard).toContain('NOTE:This is a test contact for integration testing purposes.');
    });

    it('should return empty array when no vCard data available', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'export-contacts',
        timestamp: Date.now(),
        exportResult: {},
      };
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContactsAsVCards();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([]);
    });

    it('should return error when CLI reports failure', async () => {
      const response: native_bridge.ICliResponse = {
        success: false,
        command: 'export-contacts',
        errorMessage: 'Access denied to Outlook contacts',
        timestamp: Date.now(),
      };
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContactsAsVCards();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('Access denied to Outlook contacts');
    });

    it('should return error when export result is missing', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'export-contacts',
        timestamp: Date.now(),
      };
      setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportContactsAsVCards();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('No export result returned');
    });
  });

  describe('CLI integration', () => {
    it('should use correct executable name on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const response = createTestDataResponse([JOHN_DOE_VCARD]);
      const mockSpawn = setupMockCli(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      await executor.exportContacts();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('OutlookComBridge.exe'),
        expect.any(Array),
        expect.any(Object)
      );

      // Restore platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should pass correct working directory to CLI', async () => {
      const customPath = '/custom/bridge/path';
      const response = createTestDataResponse([JANE_SMITH_VCARD]);
      const mockSpawn = setupMockCli(response);

      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const executor = new BackendOutlookNativeExecutorCli(customPath);
      await executor.exportContacts();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: customPath })
      );
    });
  });
});

/**
 * Integration tests that actually call the real CLI tool.
 * Uses --test-data flag to get synthetic data without requiring Outlook.
 *
 * NOTE: Mocks must be restored before these tests run.
 */
describe('BackendOutlookNativeExecutorCli Integration Tests', () => {
  // Try multiple possible CLI locations (prefer dist_outlookcombridge as canonical location)
  const possibleCliBridgePaths = [
    path.resolve(__dirname, '../dist_outlookcombridge'),
    path.resolve(__dirname, '../build/outlookcombridge/Release/net8.0'),
    path.resolve(__dirname, '../build/outlookcombridge/Debug/net8.0'),
  ];

  let comBridgePath: string | null = null;

  beforeAll(() => {
    // Restore real modules BEFORE checking paths
    jest.restoreAllMocks();
    jest.unmock('fs');
    jest.unmock('child_process');

    // Find the CLI tool using real fs
    const realFs = require('fs');
    for (const testPath of possibleCliBridgePaths) {
      const exePath = path.join(
        testPath,
        process.platform === 'win32' ? 'OutlookComBridge.exe' : 'OutlookComBridge'
      );
      console.log(`Checking: ${exePath}`);
      if (realFs.existsSync(exePath)) {
        comBridgePath = testPath;
        console.log(`✓ Found CLI tool at: ${testPath}`);
        break;
      }
    }

    if (!comBridgePath) {
      console.warn('⚠️  CLI tool not found. Integration tests will be skipped.');
      console.warn('   Build the CLI tool first. Checked paths:');
      possibleCliBridgePaths.forEach((p) => {
        const exePath = path.join(
          p,
          process.platform === 'win32' ? 'OutlookComBridge.exe' : 'OutlookComBridge'
        );
        const exists = realFs.existsSync(exePath);
        console.warn(`   - ${p} [${exists ? 'EXISTS' : 'NOT FOUND'}]`);
      });
    }
  });

  // Skip integration tests if CLI tool not found
  const describeIfCliExists = comBridgePath ? describeWindows : describe.skip;

  describeIfCliExists('Real CLI execution with --test-data', () => {
    it('should ping real CLI tool', async () => {
      const executor = new BackendOutlookNativeExecutorCli(comBridgePath!, false, true);

      const result = await executor.ping();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('pong');
    }, 10000);

    it('should export test contacts from real CLI with --test-data flag', async () => {
      const executor = new BackendOutlookNativeExecutorCli(comBridgePath!, false, true);

      const result = await executor.exportContacts();

      expect(result.isOk()).toBe(true);
      const vcards = result.unwrap();

      // Should contain the three test contacts
      expect(vcards).toContain('FN:John Doe');
      expect(vcards).toContain('FN:Jane Smith');
      expect(vcards).toContain('FN:Bob Johnson');

      // Verify vCard structure
      expect(vcards).toContain('BEGIN:VCARD');
      expect(vcards).toContain('END:VCARD');
      expect(vcards).toContain('VERSION:3.0');

      console.log(`✓ Received ${vcards.split('BEGIN:VCARD').length - 1} contacts`);
    }, 10000);

    it('should export individual test vCards from real CLI', async () => {
      const executor = new BackendOutlookNativeExecutorCli(comBridgePath!, false, true);

      const result = await executor.exportContactsAsVCards();

      expect(result.isOk()).toBe(true);
      const vcards = result.unwrap();

      // Should have exactly 3 test contacts
      expect(vcards).toHaveLength(3);

      // Verify each vCard
      expect(vcards[0]).toContain('FN:John Doe');
      expect(vcards[0]).toContain('ORG:Test Company Inc.');
      expect(vcards[0]).toContain('TEL;TYPE=WORK,VOICE:+1-555-123-4567');

      expect(vcards[1]).toContain('FN:Jane Smith');
      expect(vcards[1]).toContain('ORG:Another Company LLC');

      expect(vcards[2]).toContain('FN:Bob Johnson');
      expect(vcards[2]).toContain('ORG:Tech Startup');

      console.log(`✓ Received ${vcards.length} individual vCards`);
    }, 10000);

    it('should validate dependencies using real CLI', async () => {
      const executor = new BackendOutlookNativeExecutorCli(comBridgePath!, false, true);

      const result = await executor.validateDependencies();

      expect(result.isOk()).toBe(true);
      const message = result.unwrap();
      expect(message).toContain('dependencies validated');

      console.log(`✓ ${message}`);
    }, 10000);

    it('should work with JSON mode and test data', async () => {
      const executor = new BackendOutlookNativeExecutorCli(comBridgePath!, true, true);

      const result = await executor.exportContacts();

      expect(result.isOk()).toBe(true);
      const vcards = result.unwrap();

      // Should still contain test contact data
      expect(vcards).toContain('John Doe');

      console.log('✓ JSON mode works with test data');
    }, 10000);
  });
});
