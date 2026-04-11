/**
 * Integration tests for BackendOutlookNativeExecutorCli calendar export.
 *
 * These tests actually call the real CLI tool with --test-data flag.
 * NO MOCKS - this file tests real CLI interaction with stdin protobuf input.
 *
 * Prerequisites:
 * - OutlookComBridge.exe must exist in dist_outlookcombridge/
 * - Build: cd src_native/outlookcombridge && dotnet build --configuration Release
 */

import { BackendOutlookNativeExecutorCli } from '../src/pimbackend/outlook/BackendOutlookNativeExecutorCLI';
import { BackendOutlookDepsJsonGenerator } from '../src/pimbackend/outlook/BackendOutlookDepsJsonGenerator';
import { BackendVariantOutlook15Plus } from '../src/pimbackend/outlook/BackendVariantOutlook15Plus';
import { DEFAULT_DOTNET_PATH } from '../src/settings';
import { describeWindows } from './testUtils';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describeWindows('BackendOutlookNativeExecutorCli Calendar Integration Tests', () => {
  const sourceCliBridgePath = path.resolve(__dirname, '../dist_outlookcombridge');

  let tempTestDir: string | null = null;
  let comBridgePath: string | null = null;

  beforeAll(() => {
    const exeName = process.platform === 'win32' ? 'OutlookComBridge.exe' : 'OutlookComBridge';
    const sourceExePath = path.join(sourceCliBridgePath, exeName);

    if (!fs.existsSync(sourceExePath)) {
      console.warn('⚠️  CLI tool not found. Integration tests will be skipped.');
      console.warn(
        '   Build: cd src_native/outlookcombridge && dotnet build --configuration Release'
      );
      return;
    }

    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlook-calendar-integration-'));

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

    comBridgePath = tempTestDir;
  });

  afterAll(() => {
    if (tempTestDir && fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  describe('Calendar export with --test-data', () => {
    it('should export test calendar data', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, false, true);
      const result = await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      expect(result.isOk()).toBe(true);
      const ical = result.unwrap();

      expect(ical).toContain('BEGIN:VCALENDAR');
      expect(ical).toContain('END:VCALENDAR');
      expect(ical).toContain('BEGIN:VEVENT');
      expect(ical).toContain('END:VEVENT');
      expect(ical).toContain('VERSION:2.0');

      // Verify test events are present
      expect(ical).toContain('SUMMARY:Team Standup');
      expect(ical).toContain('SUMMARY:Project Review');
      expect(ical).toContain('SUMMARY:Lunch with Müller & Associés');

      const eventCount = (ical.match(/BEGIN:VEVENT/g) || []).length;
      console.log(`✓ Received ${eventCount} test calendar events`);
      expect(eventCount).toBe(3);
    }, 10000);

    it('should export calendar with JSON mode and test data', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, true, true);
      const result = await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      expect(result.isOk()).toBe(true);
      const ical = result.unwrap();

      expect(ical).toContain('Team Standup');
      expect(ical).toContain('Project Review');

      console.log('✓ JSON mode works correctly for calendar export');
    }, 10000);

    it('should preserve special characters in calendar data', async () => {
      if (!comBridgePath) {
        console.log('Skipping: CLI tool not found');
        return;
      }

      const executor = new BackendOutlookNativeExecutorCli(comBridgePath, false, true);
      const result = await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      expect(result.isOk()).toBe(true);
      const ical = result.unwrap();

      expect(ical).toContain('Müller');
      expect(ical).toContain('Associés');
      expect(ical).toContain('Ångström');
      expect(ical).toContain('München');

      console.log('✓ Special characters preserved in calendar export');
    }, 10000);
  });
});
