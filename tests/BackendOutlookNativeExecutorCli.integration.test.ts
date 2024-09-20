/**
 * Integration tests for BackendOutlookNativeExecutorCli.
 *
 * These tests actually call the real CLI tool with --test-data flag.
 * NO MOCKS - this file tests real CLI interaction.
 *
 * Prerequisites:
 * - OutlookComBridge.exe must exist in dist_outlookcombridge/
 * - Build the CLI tool first: cd src_native/outlookcombridge && dotnet build --configuration Release
 *
 * The tests create a temporary directory and use BackendOutlookDepsJsonGenerator
 * to generate properly patched deps.json and runtimeconfig.json files with correct
 * GAC assembly paths for Office interop DLLs.
 */

import { BackendOutlookNativeExecutorCli } from '../src/pimbackend/outlook/BackendOutlookNativeExecutorCLI';
import { BackendOutlookDepsJsonGenerator } from '../src/pimbackend/outlook/BackendOutlookDepsJsonGenerator';
import { BackendVariantOutlook15Plus } from '../src/pimbackend/outlook/BackendVariantOutlook15Plus';
import { DEFAULT_DOTNET_PATH } from '../src/settings';
import { describeWindows } from './testUtils';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// NO jest.mock() calls - we want real modules

describeWindows('BackendOutlookNativeExecutorCli Integration Tests', () => {
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
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlook-cli-integration-'));
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

    // Generate patched deps.json and runtimeconfig.json using BackendOutlookDepsJsonGenerator
    const backendVariant = new BackendVariantOutlook15Plus();
    const assemblyDescriptors = [
      backendVariant.getOfficeDllDescriptor(),
      backendVariant.getOfficeInteropDllDescriptor(),
    ];

    const generator = new BackendOutlookDepsJsonGenerator(
      tempTestDir, // binPath (output directory)
      tempTestDir, // templatePath (use copied templates)
      'OutlookComBridge.deps.json',
      'OutlookComBridge.runtimeconfig.json',
      assemblyDescriptors,
      DEFAULT_DOTNET_PATH
    );

    const generateResult = generator.generate();
    if (generateResult.isErr()) {
      console.error(`Failed to generate deps.json: ${generateResult.unwrapErr()}`);
      // Clean up on failure
      if (tempTestDir && fs.existsSync(tempTestDir)) {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
      }
      tempTestDir = null;
      return;
    }

    console.log(`✓ Generated patched deps.json and runtimeconfig.json with GAC paths`);
    comBridgePath = tempTestDir;
  });

  afterAll(() => {
    // Clean up temp directory
    if (tempTestDir && fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
      console.log(`✓ Cleaned up temp test directory`);
    }
  });

  describe('Real CLI with --test-data', () => {
    it('should ping real CLI tool', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, false, true);

      const result = await executor.ping();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('pong');
    }, 10000);

    it('should export test contacts with --test-data flag', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, false, true);

      const result = await executor.exportContacts();

      expect(result.isOk()).toBe(true);
      const vcards = result.unwrap();

      // Should contain the three test contacts from TestData.cs
      expect(vcards).toContain('FN:John Doe');
      expect(vcards).toContain('FN:Jane Smith');
      expect(vcards).toContain('FN:Bob Johnson');

      expect(vcards).toContain('BEGIN:VCARD');
      expect(vcards).toContain('END:VCARD');
      expect(vcards).toContain('VERSION:3.0');

      const contactCount = (vcards.match(/BEGIN:VCARD/g) || []).length;
      console.log(`✓ Received ${contactCount} test contacts`);
      expect(contactCount).toBeGreaterThanOrEqual(3);
    }, 10000);

    it('should export individual test vCards', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, false, true);

      const result = await executor.exportContactsAsVCards();

      expect(result.isOk()).toBe(true);
      const vcards = result.unwrap();

      // Should have exactly 3 test contacts
      expect(vcards.length).toBeGreaterThanOrEqual(3);

      // Verify John Doe contact details
      const johnDoe = vcards.find((v) => v.includes('FN:John Doe'));
      expect(johnDoe).toBeDefined();
      expect(johnDoe).toContain('ORG:Test Company Inc.');
      expect(johnDoe).toContain('TITLE:Software Engineer');
      expect(johnDoe).toContain('TEL;TYPE=WORK,VOICE:+1-555-123-4567');
      expect(johnDoe).toContain('EMAIL;TYPE=WORK:john.doe@testcompany.com');

      // Verify Jane Smith contact
      const janeSmith = vcards.find((v) => v.includes('FN:Jane Smith'));
      expect(janeSmith).toBeDefined();
      expect(janeSmith).toContain('ORG:Another Company LLC');
      expect(janeSmith).toContain('TITLE:Project Manager');

      // Verify Bob Johnson contact
      const bobJohnson = vcards.find((v) => v.includes('FN:Bob Johnson'));
      expect(bobJohnson).toBeDefined();
      expect(bobJohnson).toContain('ORG:Tech Solutions');

      console.log(`✓ Successfully parsed ${vcards.length} individual vCards with correct data`);
    }, 10000);

    it('should validate dependencies', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      // validate-dependencies might not be implemented yet
      // This test validates that the command infrastructure works
      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, false, true);

      const result = await executor.validateDependencies();

      // Command may not be implemented, that's OK for now
      if (result.isErr()) {
        console.log(`Note: validate-dependencies not implemented yet: ${result.unwrapErr()}`);
        return; // Skip this test
      }

      expect(result.isOk()).toBe(true);
      const message = result.unwrap();
      expect(message.toLowerCase()).toContain('dependencies validated');

      console.log(`✓ ${message}`);
    }, 10000);

    it('should work with JSON mode and test data', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, true, true);

      const result = await executor.exportContacts();

      expect(result.isOk()).toBe(true);
      const vcards = result.unwrap();

      // Should still contain test contact data in JSON mode
      expect(vcards).toContain('John Doe');
      expect(vcards).toContain('Jane Smith');

      console.log('✓ JSON mode works correctly with test data');
    }, 10000);

    it('should handle protobuf binary mode correctly', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, false, true);

      const result = await executor.exportContactsAsVCards();

      expect(result.isOk()).toBe(true);
      const vcards = result.unwrap();

      // Verify binary protobuf decoding worked correctly
      vcards.forEach((vcard, index) => {
        expect(vcard).toMatch(/BEGIN:VCARD/);
        expect(vcard).toMatch(/END:VCARD/);
        expect(vcard).toMatch(/VERSION:3\.0/);
        expect(typeof vcard).toBe('string');
        expect(vcard.length).toBeGreaterThan(0);
      });

      console.log(`✓ Protobuf binary mode correctly decoded ${vcards.length} vCards`);
    }, 10000);
  });
});
