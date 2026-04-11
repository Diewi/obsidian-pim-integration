/**
 * Unit tests for BackendOutlookNativeExecutorCli calendar export.
 *
 * Tests calendar-specific CLI functionality:
 * - Calendar export method (exportCalendar)
 * - CalendarData extraction from ExportResult
 * - CliRequest with CalendarExportParams sent via stdin
 * - Test data matching C# TestData.TestICalendar
 */

import { BackendOutlookNativeExecutorCli } from '../src/pimbackend/outlook/BackendOutlookNativeExecutorCLI';
import { native_bridge } from '../src_generated/native_bridge';
import * as child_process from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

// Test iCalendar data matching C# TestData.TestICalendar
const TEST_ICALENDAR =
  'BEGIN:VCALENDAR\r\n' +
  'VERSION:2.0\r\n' +
  'PRODID:-//OutlookComBridge//Test//EN\r\n' +
  'METHOD:PUBLISH\r\n' +
  'BEGIN:VEVENT\r\n' +
  'DTSTART:20260410T090000Z\r\n' +
  'DTEND:20260410T100000Z\r\n' +
  'SUMMARY:Team Standup\r\n' +
  'DESCRIPTION:Daily standup meeting with the engineering team.\r\n' +
  'LOCATION:Conference Room A\r\n' +
  'UID:test-event-001@outlookcombridge\r\n' +
  'END:VEVENT\r\n' +
  'BEGIN:VEVENT\r\n' +
  'DTSTART:20260415T140000Z\r\n' +
  'DTEND:20260415T153000Z\r\n' +
  'SUMMARY:Project Review\r\n' +
  'DESCRIPTION:Quarterly project review with stakeholders.\r\n' +
  'LOCATION:Board Room\r\n' +
  'UID:test-event-002@outlookcombridge\r\n' +
  'END:VEVENT\r\n' +
  'BEGIN:VEVENT\r\n' +
  'DTSTART:20260420T110000Z\r\n' +
  'DTEND:20260420T120000Z\r\n' +
  'SUMMARY:Lunch with Müller & Associés\r\n' +
  'DESCRIPTION:Business lunch — discuss Ångström project timeline.\r\n' +
  'LOCATION:Restaurant Königshof, München\r\n' +
  'UID:test-event-003@outlookcombridge\r\n' +
  'END:VEVENT\r\n' +
  'END:VCALENDAR\r\n';

const TEST_ICALENDAR_EVENT_COUNT = 3;

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
 * Create a mock stdin stream that records written data.
 */
function createMockStdin() {
  const written: Buffer[] = [];
  return {
    write: jest.fn((data: any) => written.push(Buffer.from(data))),
    end: jest.fn((data?: any) => {
      if (data) written.push(Buffer.from(data));
    }),
    written,
  };
}

/**
 * Helper to setup mock spawn with CLI response, capturing stdin.
 */
function setupMockCliWithStdin(response: native_bridge.ICliResponse) {
  const buffer = createLengthPrefixedBuffer(response);
  const mockStdin = createMockStdin();

  const mockSpawn = jest.fn().mockReturnValue({
    stdin: mockStdin,
    stdout: {
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') callback(buffer);
      }),
    },
    stderr: { on: jest.fn() },
    on: jest.fn((event: string, callback: Function) => {
      if (event === 'close') callback(0);
    }),
  });
  (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);
  return { mockSpawn, mockStdin };
}

/**
 * Create a successful calendar export response with test data.
 */
function createCalendarTestResponse(): native_bridge.ICliResponse {
  return {
    success: true,
    command: 'export-calendar',
    timestamp: Date.now(),
    exportResult: {
      calendar: {
        ical: TEST_ICALENDAR,
        eventCount: TEST_ICALENDAR_EVENT_COUNT,
      },
    },
  };
}

describe('BackendOutlookNativeExecutorCli - Calendar Export', () => {
  const mockComBridgePath = '/test/outlookcombridge';

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  describe('exportCalendar', () => {
    it('should export calendar data from CLI', async () => {
      const response = createCalendarTestResponse();
      const { mockSpawn } = setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const startDate = new Date('2026-04-01T00:00:00Z');
      const endDate = new Date('2026-04-30T23:59:59Z');

      const result = await executor.exportCalendar(startDate, endDate);

      expect(result.isOk()).toBe(true);
      const ical = result.unwrap();
      expect(ical).toContain('BEGIN:VCALENDAR');
      expect(ical).toContain('END:VCALENDAR');

      // Verify spawn was called with export-calendar command
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('OutlookComBridge'),
        ['export-calendar'],
        expect.objectContaining({
          cwd: mockComBridgePath,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('should send CliRequest with CalendarExportParams via stdin', async () => {
      const response = createCalendarTestResponse();
      const { mockStdin } = setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const startDate = new Date('2026-04-01T00:00:00Z');
      const endDate = new Date('2026-04-30T23:59:59Z');

      await executor.exportCalendar(startDate, endDate, true);

      // Verify stdin.end was called with binary protobuf data
      expect(mockStdin.end).toHaveBeenCalled();
      const stdinData = mockStdin.end.mock.calls[0][0];
      expect(stdinData).toBeInstanceOf(Buffer);

      // Decode the request to verify contents
      const request = native_bridge.CliRequest.decode(stdinData);
      expect(request.calendarExport).toBeDefined();
      expect(request.calendarExport!.includePrivate).toBe(true);
      // startDate/endDate are .NET ticks — just verify they are non-zero
      expect(Number(request.calendarExport!.startDate)).toBeGreaterThan(0);
      expect(Number(request.calendarExport!.endDate)).toBeGreaterThan(0);
    });

    it('should contain all test events', async () => {
      const response = createCalendarTestResponse();
      setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      expect(result.isOk()).toBe(true);
      const ical = result.unwrap();
      expect(ical).toContain('SUMMARY:Team Standup');
      expect(ical).toContain('SUMMARY:Project Review');
      expect(ical).toContain('SUMMARY:Lunch with Müller & Associés');
    });

    it('should preserve special characters in calendar data', async () => {
      const response = createCalendarTestResponse();
      setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      expect(result.isOk()).toBe(true);
      const ical = result.unwrap();
      expect(ical).toContain('Müller');
      expect(ical).toContain('Associés');
      expect(ical).toContain('Ångström');
      expect(ical).toContain('Königshof');
      expect(ical).toContain('München');
    });

    it('should return error when CLI reports failure', async () => {
      const response: native_bridge.ICliResponse = {
        success: false,
        command: 'export-calendar',
        errorMessage: 'Outlook calendar not accessible',
        timestamp: Date.now(),
      };
      setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('Outlook calendar not accessible');
    });

    it('should return error when export result is missing', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'export-calendar',
        timestamp: Date.now(),
      };
      setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('No export result returned');
    });

    it('should return error when calendar data is missing in export result', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'export-calendar',
        timestamp: Date.now(),
        exportResult: {},
      };
      setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      const result = await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('No calendar data in export result');
    });

    it('should default includePrivate to false', async () => {
      const response = createCalendarTestResponse();
      const { mockStdin } = setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      const stdinData = mockStdin.end.mock.calls[0][0];
      const request = native_bridge.CliRequest.decode(stdinData);
      expect(request.calendarExport!.includePrivate).toBe(false);
    });

    it('should use stdin pipe when request is provided', async () => {
      const response = createCalendarTestResponse();
      const { mockSpawn } = setupMockCliWithStdin(response);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      await executor.exportCalendar(
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z')
      );

      // Verify stdio[0] is 'pipe' (not 'ignore') when request is provided
      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[2].stdio[0]).toBe('pipe');
    });
  });

  describe('exportContacts still works with ignore stdin', () => {
    it('should use ignore stdin when no request is provided', async () => {
      const response: native_bridge.ICliResponse = {
        success: true,
        command: 'export-contacts',
        timestamp: Date.now(),
        exportResult: {
          vcards: { vcards: ['BEGIN:VCARD\nFN:Test\nEND:VCARD'] },
        },
      };
      const buffer = createLengthPrefixedBuffer(response);
      const mockSpawn = jest.fn().mockReturnValue({
        stdout: {
          on: jest.fn((event: string, callback: Function) => {
            if (event === 'data') callback(buffer);
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'close') callback(0);
        }),
      });
      (child_process.spawn as jest.Mock).mockImplementation(mockSpawn);

      const executor = new BackendOutlookNativeExecutorCli(mockComBridgePath);
      await executor.exportContacts();

      // Verify stdio[0] is 'ignore' when no request is provided
      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[2].stdio[0]).toBe('ignore');
    });
  });
});
