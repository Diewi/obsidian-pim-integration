import { CalendarImporterBase } from '../src/calendar/CalendarImporterBase';
import { ICalendarImporterBackend } from '../src/calendar/ICalendarImporterBackend';
import { IVaultEventScanner } from '../src/calendar/IVaultEventScanner';
import { CalendarEvent } from '../src/calendar/CalendarEvent';
import { Ok, Err, Result } from 'oxide.ts';
import * as fs from 'fs';
import * as path from 'path';
import { TEST_ICALENDAR, TEST_ICALENDAR_WITH_ATTENDEES } from './fixtures/testCalendarData';

/** Concrete subclass that captures writeToFile calls instead of writing to disk. */
class TestCalendarImporter extends CalendarImporterBase {
  writtenFiles: { content: string; filePath: string }[] = [];
  existingFiles: Set<string> = new Set();

  constructor(calendarDir: string, targetTemplate: string, scanner?: IVaultEventScanner, includePrivate: boolean = false) {
    super(calendarDir, targetTemplate, includePrivate);
    if (scanner) {
      this.vaultEventScanner = scanner;
    }
  }

  async writeToFile(mdContent: string, filePath: string): Promise<void> {
    this.writtenFiles.push({ content: mdContent, filePath });
  }

  async fileExists(filePath: string): Promise<boolean> {
    return this.existingFiles.has(filePath);
  }
}

/** Mock backend that returns the test iCal data. */
class MockCalendarImporterBackend implements ICalendarImporterBackend {
  private icalData: string;
  private shouldFail: boolean;

  constructor(icalData: string = TEST_ICALENDAR, shouldFail: boolean = false) {
    this.icalData = icalData;
    this.shouldFail = shouldFail;
  }

  async getCalendarEvents(_startDate: Date, _endDate: Date): Promise<Result<string, string>> {
    if (this.shouldFail) {
      return Err('Backend error');
    }
    return Ok(this.icalData);
  }
}

describe('CalendarImporterBase', () => {
  const SIMPLE_TEMPLATE =
    '# ${summary}\n' +
    'Date: ${startDate|yyyy-MM-dd}\n' +
    'Time: ${startDate|HH:mm} - ${endDate|HH:mm}\n' +
    'Duration: ${durationMinutes} min\n' +
    'Location: ${location}\n' +
    'Description: ${description}';

  describe('transformICalToTargetFormat', () => {
    test('transforms all events using the template', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      const result = await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      expect(result.isOk()).toBe(true);
      expect(importer.writtenFiles).toHaveLength(3);
    });

    test('applies template substitution correctly', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      const firstFile = importer.writtenFiles[0];
      expect(firstFile.content).toContain('# Team Standup');
      expect(firstFile.content).toContain('Date: 2026-04-10');
      expect(firstFile.content).toContain('Time: 09:00 - 10:00');
      expect(firstFile.content).toContain('Duration: 60 min');
      expect(firstFile.content).toContain('Location: Conference Room A');
    });

    test('generates correct file paths', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      expect(importer.writtenFiles[0].filePath).toBe('calendar/2026-04-10 Team Standup.md');
      expect(importer.writtenFiles[1].filePath).toBe('calendar/2026-04-15 Project Review.md');
      expect(importer.writtenFiles[2].filePath).toBe('calendar/2026-04-20 Lunch with Müller & Associés.md');
    });

    test('returns Ok message with event count on success', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      const result = await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      expect(result.unwrap()).toBe('3 event(s) imported');
    });

    test('returns Ok message when no events found', async () => {
      const emptyCalendar =
        'BEGIN:VCALENDAR\r\n' +
        'VERSION:2.0\r\n' +
        'END:VCALENDAR\r\n';
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      const result = await importer.transformICalToTargetFormat(emptyCalendar);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toContain('No calendar events');
      expect(importer.writtenFiles).toHaveLength(0);
    });

    test('handles unicode in template output', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      const unicodeFile = importer.writtenFiles[2];
      expect(unicodeFile.content).toContain('Müller & Associés');
      expect(unicodeFile.content).toContain('Ångström');
      expect(unicodeFile.content).toContain('Königshof, München');
    });

    test('filters events to the requested date range', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      // Only April 15 (the Project Review event)
      const start = new Date('2026-04-15T00:00:00Z');
      const end = new Date('2026-04-16T00:00:00Z');
      const result = await importer.transformICalToTargetFormat(TEST_ICALENDAR, start, end);

      expect(result.isOk()).toBe(true);
      expect(importer.writtenFiles).toHaveLength(1);
      expect(importer.writtenFiles[0].content).toContain('# Project Review');
    });

    test('returns no events message when none match date range', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      const start = new Date('2026-05-01T00:00:00Z');
      const end = new Date('2026-05-02T00:00:00Z');
      const result = await importer.transformICalToTargetFormat(TEST_ICALENDAR, start, end);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toContain('No calendar events');
    });

    test('includes all events when no date range specified', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      const result = await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      expect(result.isOk()).toBe(true);
      expect(importer.writtenFiles).toHaveLength(3);
    });
  });

  describe('transformCalendarEvents (with backend)', () => {
    test('fetches iCal from backend and transforms', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      const backend = new MockCalendarImporterBackend();
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-30');

      const result = await importer.transformCalendarEvents(backend, startDate, endDate);

      expect(result.isOk()).toBe(true);
      expect(importer.writtenFiles).toHaveLength(3);
    });

    test('returns error when backend fails', async () => {
      const importer = new TestCalendarImporter('calendar', SIMPLE_TEMPLATE);
      const backend = new MockCalendarImporterBackend('', true);
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-30');

      const result = await importer.transformCalendarEvents(backend, startDate, endDate);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('Backend error');
    });
  });

  describe('transformSingleEvent', () => {
    test('substitutes all template placeholders', () => {
      const template =
        'UID: ${uid}\n' +
        'Summary: ${summary}\n' +
        'Organizer: ${organizer}\n' +
        'Status: ${status}\n' +
        'Attendees: ${attendees}';

      const importer = new TestCalendarImporter('calendar', template);
      const event: CalendarEvent = {
        summary: 'Test Event',
        description: 'A test',
        location: 'Room 1',
        startDate: new Date('2026-05-01T10:00:00.000Z'),
        endDate: new Date('2026-05-01T11:00:00.000Z'),
        durationMinutes: 60,
        uid: 'uid-123',
        organizer: 'John Doe',
        status: 'CONFIRMED',
        attendees: 'Alice, Bob',
        attendeeList: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
        recurrenceRule: '',
        recurrenceId: '',
        previousEventLink: '',
      classType: '',
      isAllDay: false,
      };

      const result = importer.transformSingleEvent(event);
      expect(result.isOk()).toBe(true);
      const content = result.unwrap();
      expect(content).toContain('UID: uid-123');
      expect(content).toContain('Summary: Test Event');
      expect(content).toContain('Organizer: John Doe');
      expect(content).toContain('Status: CONFIRMED');
      expect(content).toContain('Attendees: Alice, Bob');
    });

    test('handles missing optional fields gracefully', () => {
      const template = 'Summary: ${summary}\nOrganizer: ${organizer}';
      const importer = new TestCalendarImporter('calendar', template);
      const event: CalendarEvent = {
        summary: 'Minimal Event',
        description: '',
        location: '',
        startDate: null,
        endDate: null,
        durationMinutes: 0,
        uid: '',
        organizer: '',
        status: '',
        attendees: '',
        attendeeList: [],
        recurrenceRule: '',
        recurrenceId: '',
        previousEventLink: '',
        classType: '',
      isAllDay: false,
      };

      const result = importer.transformSingleEvent(event);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toContain('Summary: Minimal Event');
      expect(result.unwrap()).toContain('Organizer:');
    });
  });

  describe('getDefaultEventFileName', () => {
    const importer = new TestCalendarImporter('calendar', '');

    test('generates "YYYY-MM-DD Summary" format', () => {
      const result = importer.getDefaultEventFileName({
        startDate: new Date('2026-04-10T09:00:00.000Z'),
        summary: 'Team Standup',
      } as CalendarEvent);
      expect(result.unwrap()).toBe('2026-04-10 Team Standup');
    });

    test('sanitizes invalid filename characters', () => {
      const result = importer.getDefaultEventFileName({
        startDate: new Date('2026-04-10T09:00:00.000Z'),
        summary: 'Meeting: Q&A <Review>',
      } as CalendarEvent);
      expect(result.unwrap()).toBe('2026-04-10 Meeting_ Q&A _Review_');
    });

    test('returns undated prefix when startDate is null', () => {
      const result = importer.getDefaultEventFileName({
        startDate: null,
        summary: 'No Date',
      } as CalendarEvent);
      expect(result.unwrap()).toBe('undated No Date');
    });

    test('returns error when summary is empty', () => {
      const result = importer.getDefaultEventFileName({
        startDate: new Date('2026-04-10T09:00:00.000Z'),
        summary: '',
      } as CalendarEvent);
      expect(result.isErr()).toBe(true);
    });
  });

  describe('resolveCalendarDir', () => {
    test('resolves placeholders in directory path', () => {
      const importer = new TestCalendarImporter('Calendar/${startDate|yyyy-MM-dd}', '');
      const result = importer.resolveCalendarDir({
        startDate: new Date('2026-04-10T09:00:00.000Z'),
        summary: 'Test',
      } as CalendarEvent);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Calendar/2026-04-10');
    });

    test('resolves multiple placeholders', () => {
      const importer = new TestCalendarImporter('Calendar/${startDate|yyyy-MM-dd}/${location}', '');
      const result = importer.resolveCalendarDir({
        startDate: new Date('2026-04-10T09:00:00.000Z'),
        location: 'Room A',
      } as CalendarEvent);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Calendar/2026-04-10/Room A');
    });

    test('returns static path unchanged when no placeholders', () => {
      const importer = new TestCalendarImporter('Resources/Calendar', '');
      const result = importer.resolveCalendarDir({
        startDate: new Date('2026-04-10T09:00:00.000Z'),
        summary: 'Test',
      } as CalendarEvent);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Resources/Calendar');
    });

    test('returns Err when placeholder resolves to empty segment between slashes', () => {
      const importer = new TestCalendarImporter('Calendar/${startDate|yyyy-MM-dd}/notes', '');
      const result = importer.resolveCalendarDir({
        startDate: null,
        summary: 'Broken Event',
      } as CalendarEvent);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('empty segments');
      expect(result.unwrapErr()).toContain('Broken Event');
    });

    test('allows trailing empty segment (no error)', () => {
      const importer = new TestCalendarImporter('Calendar/${location}', '');
      const result = importer.resolveCalendarDir({
        startDate: new Date('2026-04-10T09:00:00.000Z'),
        location: '',
      } as CalendarEvent);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Calendar/');
    });
  });

  describe('getCalendarBaseDir', () => {
    test('returns path up to folder before first placeholder', () => {
      const importer = new TestCalendarImporter('Calendar/${startDate|yyyy-MM-dd}', '');
      expect(importer.getCalendarBaseDir()).toBe('Calendar/');
    });

    test('returns full path when no placeholders', () => {
      const importer = new TestCalendarImporter('Resources/Calendar', '');
      expect(importer.getCalendarBaseDir()).toBe('Resources/Calendar');
    });

    test('handles nested path with placeholder in last segment', () => {
      const importer = new TestCalendarImporter('Resources/Calendar/${startDate|yyyy-MM-dd}', '');
      expect(importer.getCalendarBaseDir()).toBe('Resources/Calendar/');
    });

    test('handles placeholder in first segment', () => {
      const importer = new TestCalendarImporter('${startDate|yyyy-MM-dd}/notes', '');
      expect(importer.getCalendarBaseDir()).toBe('');
    });

    test('handles multiple placeholders', () => {
      const importer = new TestCalendarImporter('Calendar/${startDate|yyyy-MM-dd}/${location}', '');
      expect(importer.getCalendarBaseDir()).toBe('Calendar/');
    });

    test('handles placeholder mid-segment', () => {
      const importer = new TestCalendarImporter('Calendar/year-${startDate|yyyy}', '');
      expect(importer.getCalendarBaseDir()).toBe('Calendar/');
    });

    test('full path mode strips filename before extracting base dir', () => {
      const importer = new TestCalendarImporter('Calendar/${startDate|yyyy-MM-dd} ${summary}.md', '');
      expect(importer.getCalendarBaseDir()).toBe('Calendar');
    });

    test('full path mode with nested dirs strips filename', () => {
      const importer = new TestCalendarImporter('Calendar/${startDate|yyyy}/${startDate|yyyy-MM-dd} ${summary}.md', '');
      expect(importer.getCalendarBaseDir()).toBe('Calendar/');
    });

    test('full path mode with static dir returns dir portion', () => {
      const importer = new TestCalendarImporter('Resources/Calendar/event.md', '');
      expect(importer.getCalendarBaseDir()).toBe('Resources/Calendar');
    });
  });

  describe('writeToFile receives resolved file path', () => {
    test('events on different dates produce different directories', async () => {
      const importer = new TestCalendarImporter('Calendar/${startDate|yyyy-MM-dd}', SIMPLE_TEMPLATE);
      await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      expect(importer.writtenFiles).toHaveLength(3);
      expect(importer.writtenFiles[0].filePath).toBe('Calendar/2026-04-10/2026-04-10 Team Standup.md');
      expect(importer.writtenFiles[1].filePath).toBe('Calendar/2026-04-15/2026-04-15 Project Review.md');
      expect(importer.writtenFiles[2].filePath).toBe('Calendar/2026-04-20/2026-04-20 Lunch with Müller & Associés.md');
    });

    test('static directory is the same for all events', async () => {
      const importer = new TestCalendarImporter('Calendar/All', SIMPLE_TEMPLATE);
      await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      for (const file of importer.writtenFiles) {
        expect(file.filePath).toMatch(/^Calendar\/All\//);
        expect(file.filePath).toMatch(/\.md$/);
      }
    });

    test('full path mode with .md suffix uses custom filename', async () => {
      const importer = new TestCalendarImporter(
        'Calendar/${startDate|yyyy-MM-dd} ${summary}.md',
        SIMPLE_TEMPLATE
      );
      await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      expect(importer.writtenFiles).toHaveLength(3);
      expect(importer.writtenFiles[0].filePath).toBe('Calendar/2026-04-10 Team Standup.md');
      expect(importer.writtenFiles[1].filePath).toBe('Calendar/2026-04-15 Project Review.md');
      expect(importer.writtenFiles[2].filePath).toBe('Calendar/2026-04-20 Lunch with Müller & Associés.md');
    });

    test('full path mode with subdirectory and .md suffix', async () => {
      const importer = new TestCalendarImporter(
        'Calendar/${startDate|yyyy}/${startDate|yyyy-MM-dd} ${summary}.md',
        SIMPLE_TEMPLATE
      );
      await importer.transformICalToTargetFormat(TEST_ICALENDAR);

      expect(importer.writtenFiles).toHaveLength(3);
      expect(importer.writtenFiles[0].filePath).toBe('Calendar/2026/2026-04-10 Team Standup.md');
      expect(importer.writtenFiles[1].filePath).toBe('Calendar/2026/2026-04-15 Project Review.md');
      expect(importer.writtenFiles[2].filePath).toBe('Calendar/2026/2026-04-20 Lunch with Müller & Associés.md');
    });
  });

  describe('template engine integration with attendeeList array', () => {
    test('uses array template syntax for attendees', () => {
      const template = 'Attendees:\n${attendeeList[].`- ${name} (${email})`}';
      const importer = new TestCalendarImporter('calendar', template);

      const event: CalendarEvent = {
        summary: 'Meeting',
        description: '',
        location: '',
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        durationMinutes: 0,
        uid: 'uid-1',
        organizer: '',
        status: '',
        attendees: 'Alice, Bob',
        attendeeList: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
        recurrenceRule: '',
        recurrenceId: '',
        previousEventLink: '',
        classType: '',
      isAllDay: false,
      };

      const result = importer.transformSingleEvent(event);
      expect(result.isOk()).toBe(true);
      const content = result.unwrap();
      expect(content).toContain('- Alice (alice@example.com)');
      expect(content).toContain('- Bob (bob@example.com)');
    });
  });
});

describe('CalendarImporterBase with MarkdownCalendarTemplate', () => {
  const templatePath = path.resolve(__dirname, 'MarkdownCalendarTemplate.md');
  let REAL_TEMPLATE: string;

  beforeAll(() => {
    REAL_TEMPLATE = fs.readFileSync(templatePath, 'utf-8');
  });

  test('template file loads successfully', () => {
    expect(REAL_TEMPLATE).toBeDefined();
    expect(REAL_TEMPLATE.length).toBeGreaterThan(0);
    expect(REAL_TEMPLATE).toContain('${startDate|yyyy-MM-dd HH:mm}');
    expect(REAL_TEMPLATE).toContain('${attendeeList[].`');
  });

  test('transforms all events from iCal with attendees', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    const result = await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(3);
  });

  test('renders frontmatter with meeting date', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    const firstFile = importer.writtenFiles[0];
    expect(firstFile.content).toContain('meetingDate: 2026-04-10 09:00');
    expect(firstFile.content).toContain('tags: [Meetings]');
  });

  test('renders attendee list as checklist items', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    // Event 1 has 3 attendees — names wrapped in [[...]] wiki-links
    const firstFile = importer.writtenFiles[0];
    expect(firstFile.content).toContain(' - [ ] [[Bob Developer]]');
    expect(firstFile.content).toContain(' - [ ] [[Charlie Tester]]');
    expect(firstFile.content).toContain(' - [ ] [[Diana Designer]]');
  });

  test('renders empty attendee list for event without attendees', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    // Event 2 (Project Review) has no attendees
    const secondFile = importer.writtenFiles[1];
    expect(secondFile.content).toContain('### Participants %% fold %%');
    // No checklist items between Participants and Agenda
    const participantsIdx = secondFile.content.indexOf('### Participants %% fold %%');
    const agendaIdx = secondFile.content.indexOf('### Agenda');
    const between = secondFile.content.slice(participantsIdx, agendaIdx);
    expect(between).not.toContain('- [ ]');
  });

  test('renders unicode attendee names correctly', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    const thirdFile = importer.writtenFiles[2];
    expect(thirdFile.content).toContain(' - [ ] [[François Müller]]');
    expect(thirdFile.content).toContain(' - [ ] [[Eva Schmidt]]');
  });

  test('preserves insta-toc syntax untouched', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    const content = importer.writtenFiles[0].content;
    // insta-toc code block should remain intact
    expect(content).toContain('```insta-toc');
    expect(content).toContain('listType: dash');
  });

  test('parent link contains formatted startDate with weekday', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    const content = importer.writtenFiles[0].content;
    // 2026-04-10 is a Friday
    expect(content).toContain('parent: "[[2026-04-10-Friday]]"');
  });

  test('renders uid in frontmatter', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    const content = importer.writtenFiles[0].content;
    expect(content).toContain('uid: test-event-001@outlookcombridge');
  });

  test('renders empty previousEventLink when no scanner is set', async () => {
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE);
    await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

    const content = importer.writtenFiles[0].content;
    expect(content).toContain('previous: ""');
  });
});

/** Mock implementation of IVaultEventScanner for testing. */
class MockVaultEventScanner implements IVaultEventScanner {
  private notes: { uid: string; meetingDate: string; notePath: string; content?: string }[];
  lastBaseDir: string | undefined;

  constructor(notes: { uid: string; meetingDate: string; notePath: string; content?: string }[]) {
    this.notes = notes;
  }

  findPreviousOccurrenceNote(uid: string, beforeDate: string, baseDir: string): string | null {
    this.lastBaseDir = baseDir;
    const candidates = this.notes
      .filter((n) => n.uid === uid && n.meetingDate < beforeDate)
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
    return candidates.length > 0 ? candidates[0].notePath : null;
  }

  async readNoteContent(notePath: string, _baseDir: string): Promise<string | null> {
    const note = this.notes.find((n) => n.notePath === notePath);
    return note?.content ?? null;
  }
}

describe('resolvePreviousEventLink', () => {
  test('resolves wikilink when scanner finds a previous note', () => {
    const scanner = new MockVaultEventScanner([
      { uid: 'series-001', meetingDate: '2026-04-06', notePath: 'calendar/2026-04-06 Weekly Standup' },
    ]);
    const importer = new TestCalendarImporter('calendar', '', scanner);

    const event: CalendarEvent = {
      summary: 'Weekly Standup',
      description: '',
      location: '',
      startDate: new Date('2026-04-13T09:00:00.000Z'),
      endDate: new Date('2026-04-13T09:30:00.000Z'),
      durationMinutes: 30,
      uid: 'series-001',
      organizer: '',
      status: '',
      attendees: '',
      attendeeList: [],
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
      recurrenceId: '',
      previousEventLink: '',
      classType: '',
      isAllDay: false,
    };

    importer.resolvePreviousEventLink(event);
    expect(event.previousEventLink).toBe('[[calendar/2026-04-06 Weekly Standup]]');
  });

  test('returns empty string when no previous note exists', () => {
    const scanner = new MockVaultEventScanner([]);
    const importer = new TestCalendarImporter('calendar', '', scanner);

    const event: CalendarEvent = {
      summary: 'Weekly Standup',
      description: '',
      location: '',
      startDate: new Date('2026-04-13T09:00:00.000Z'),
      endDate: new Date('2026-04-13T09:30:00.000Z'),
      durationMinutes: 30,
      uid: 'series-001',
      organizer: '',
      status: '',
      attendees: '',
      attendeeList: [],
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
      recurrenceId: '',
      previousEventLink: '',
      classType: '',
      isAllDay: false,
    };

    importer.resolvePreviousEventLink(event);
    expect(event.previousEventLink).toBe('');
  });

  test('returns empty string when event has no recurrenceRule', () => {
    const scanner = new MockVaultEventScanner([
      { uid: 'single-001', meetingDate: '2026-04-06', notePath: 'calendar/2026-04-06 Some Meeting' },
    ]);
    const importer = new TestCalendarImporter('calendar', '', scanner);

    const event: CalendarEvent = {
      summary: 'Some Meeting',
      description: '',
      location: '',
      startDate: new Date('2026-04-13T00:00:00.000Z'),
      endDate: new Date('2026-04-13T00:00:00.000Z'),
      durationMinutes: 0,
      uid: 'single-001',
      organizer: '',
      status: '',
      attendees: '',
      attendeeList: [],
      recurrenceRule: '',
      recurrenceId: '',
      previousEventLink: '',
      classType: '',
      isAllDay: false,
    };

    importer.resolvePreviousEventLink(event);
    expect(event.previousEventLink).toBe('');
  });

  test('returns empty string when no scanner is available', () => {
    const importer = new TestCalendarImporter('calendar', '');

    const event: CalendarEvent = {
      summary: 'Weekly Standup',
      description: '',
      location: '',
      startDate: new Date('2026-04-13T00:00:00.000Z'),
      endDate: new Date('2026-04-13T00:00:00.000Z'),
      durationMinutes: 0,
      uid: 'series-001',
      organizer: '',
      status: '',
      attendees: '',
      attendeeList: [],
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
      recurrenceId: '',
      previousEventLink: '',
      classType: '',
      isAllDay: false,
    };

    importer.resolvePreviousEventLink(event);
    expect(event.previousEventLink).toBe('');
  });

  test('picks the most recent previous note when multiple exist', () => {
    const scanner = new MockVaultEventScanner([
      { uid: 'series-001', meetingDate: '2026-03-23', notePath: 'calendar/2026-03-23 Weekly Standup' },
      { uid: 'series-001', meetingDate: '2026-03-30', notePath: 'calendar/2026-03-30 Weekly Standup' },
      { uid: 'series-001', meetingDate: '2026-04-06', notePath: 'calendar/2026-04-06 Weekly Standup' },
    ]);
    const importer = new TestCalendarImporter('calendar', '', scanner);

    const event: CalendarEvent = {
      summary: 'Weekly Standup',
      description: '',
      location: '',
      startDate: new Date('2026-04-13T09:00:00.000Z'),
      endDate: new Date('2026-04-13T09:30:00.000Z'),
      durationMinutes: 30,
      uid: 'series-001',
      organizer: '',
      status: '',
      attendees: '',
      attendeeList: [],
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
      recurrenceId: '',
      previousEventLink: '',
      classType: '',
      isAllDay: false,
    };

    importer.resolvePreviousEventLink(event);
    expect(event.previousEventLink).toBe('[[calendar/2026-04-06 Weekly Standup]]');
  });

  test('skips notes with same or later date', () => {
    const scanner = new MockVaultEventScanner([
      { uid: 'series-001', meetingDate: '2026-04-13', notePath: 'calendar/2026-04-13 Weekly Standup' },
      { uid: 'series-001', meetingDate: '2026-04-20', notePath: 'calendar/2026-04-20 Weekly Standup' },
    ]);
    const importer = new TestCalendarImporter('calendar', '', scanner);

    const event: CalendarEvent = {
      summary: 'Weekly Standup',
      description: '',
      location: '',
      startDate: new Date('2026-04-13T09:00:00.000Z'),
      endDate: new Date('2026-04-13T09:30:00.000Z'),
      durationMinutes: 30,
      uid: 'series-001',
      organizer: '',
      status: '',
      attendees: '',
      attendeeList: [],
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
      recurrenceId: '',
      previousEventLink: '',
      classType: '',
      isAllDay: false,
    };

    importer.resolvePreviousEventLink(event);
    expect(event.previousEventLink).toBe('');
  });
});

describe('previousEventLink in full pipeline', () => {
  const RECURRING_ICAL =
    'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260413T090000Z\r\n' +
    'DTEND:20260413T093000Z\r\n' +
    'SUMMARY:Weekly Standup\r\n' +
    'UID:series-001@test\r\n' +
    'RRULE:FREQ=WEEKLY;BYDAY=MO\r\n' +
    'STATUS:CONFIRMED\r\n' +
    'END:VEVENT\r\n' +
    'END:VCALENDAR\r\n';

  test('populates previousEventLink in template output when scanner finds match', async () => {
    const scanner = new MockVaultEventScanner([
      { uid: 'series-001@test', meetingDate: '2026-04-06', notePath: 'calendar/2026-04-06 Weekly Standup' },
    ]);
    const template = 'previous: "${previousEventLink}"\nSummary: ${summary}';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    expect(importer.writtenFiles).toHaveLength(1);
    expect(importer.writtenFiles[0].content).toContain(
      'previous: "[[calendar/2026-04-06 Weekly Standup]]"'
    );
  });

  test('leaves previousEventLink empty when no match found', async () => {
    const scanner = new MockVaultEventScanner([]);
    const template = 'previous: "${previousEventLink}"\nSummary: ${summary}';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    expect(importer.writtenFiles[0].content).toContain('previous: ""');
  });

  test('does not populate previousEventLink for non-recurring events', async () => {
    const scanner = new MockVaultEventScanner([
      { uid: 'test-event-001@outlookcombridge', meetingDate: '2026-04-03', notePath: 'calendar/2026-04-03 Team Standup' },
    ]);
    const template = 'previous: "${previousEventLink}"\nSummary: ${summary}';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    // TEST_ICALENDAR events have no RRULE
    await importer.transformICalToTargetFormat(TEST_ICALENDAR);

    // All events should have empty previousEventLink since they're non-recurring
    for (const file of importer.writtenFiles) {
      expect(file.content).toContain('previous: ""');
    }
  });

  test('integrates with real template and recurring event', async () => {
    const templatePath = path.resolve(__dirname, 'MarkdownCalendarTemplate.md');
    const REAL_TEMPLATE = fs.readFileSync(templatePath, 'utf-8');

    const scanner = new MockVaultEventScanner([
      { uid: 'series-001@test', meetingDate: '2026-04-06', notePath: 'calendar/2026-04-06 Weekly Standup' },
    ]);
    const importer = new TestCalendarImporter('calendar', REAL_TEMPLATE, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    const content = importer.writtenFiles[0].content;
    expect(content).toContain('uid: series-001@test');
    expect(content).toContain('previous: "[[calendar/2026-04-06 Weekly Standup]]"');
  });

  test('passes calendarBaseDir to scanner for scoped search', async () => {
    const scanner = new MockVaultEventScanner([
      { uid: 'series-001@test', meetingDate: '2026-04-06', notePath: 'calendar/2026-04-06 Weekly Standup' },
    ]);
    const template = 'previous: "${previousEventLink}"';
    const importer = new TestCalendarImporter('Calendar/${startDate|yyyy-MM-dd}', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    expect(scanner.lastBaseDir).toBe('Calendar/');
  });

  test('passes full static path as baseDir when no placeholders', async () => {
    const scanner = new MockVaultEventScanner([]);
    const template = 'previous: "${previousEventLink}"';
    const importer = new TestCalendarImporter('Resources/Calendar', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    expect(scanner.lastBaseDir).toBe('Resources/Calendar');
  });
});

describe('extractSection', () => {
  const NOTE_CONTENT = [
    '---',
    'tags: [Meetings]',
    'uid: series-001',
    '---',
    '### Participants',
    '- Alice',
    '- Bob',
    '',
    '### Round table',
    '- Status updates',
    '- Blockers',
    '',
    '### Notes',
    'Some notes here',
  ].join('\n');

  test('extracts heading and body for matching section', () => {
    const result = CalendarImporterBase.extractSection(NOTE_CONTENT, '### Round table');
    expect(result).toBe('### Round table\n- Status updates\n- Blockers');
  });

  test('returns empty string when heading not found', () => {
    const result = CalendarImporterBase.extractSection(NOTE_CONTENT, '### Missing');
    expect(result).toBe('');
  });

  test('stops at next heading of equal level', () => {
    const result = CalendarImporterBase.extractSection(NOTE_CONTENT, '### Participants');
    expect(result).toBe('### Participants\n- Alice\n- Bob');
  });

  test('stops at heading of higher (fewer #) level', () => {
    const content = '## Main\n### Sub\nContent\n## Next';
    const result = CalendarImporterBase.extractSection(content, '### Sub');
    expect(result).toBe('### Sub\nContent');
  });

  test('includes sub-headings of deeper level', () => {
    const content = '## Section\n### Sub1\nA\n#### Sub2\nB\n## Next';
    const result = CalendarImporterBase.extractSection(content, '## Section');
    expect(result).toBe('## Section\n### Sub1\nA\n#### Sub2\nB');
  });

  test('captures section at end of document', () => {
    const result = CalendarImporterBase.extractSection(NOTE_CONTENT, '### Notes');
    expect(result).toBe('### Notes\nSome notes here');
  });

  test('returns empty string for invalid heading format', () => {
    const result = CalendarImporterBase.extractSection(NOTE_CONTENT, 'no hashes');
    expect(result).toBe('');
  });

  test('trims trailing blank lines from section', () => {
    const content = '### A\nline 1\n\n\n### B\nline 2';
    const result = CalendarImporterBase.extractSection(content, '### A');
    expect(result).toBe('### A\nline 1');
  });
});

describe('extractMarkedSections', () => {
  test('extracts single marked section', () => {
    const content = '### Agenda\nStuff\n\n### Round table %% carryForward %%\n- Item 1\n- Item 2\n\n### Notes\nMore';
    const result = CalendarImporterBase.extractMarkedSections(content);
    expect(result).toBe('### Round table %% carryForward %%\n- Item 1\n- Item 2');
  });

  test('extracts multiple marked sections joined by blank line', () => {
    const content = [
      '### Participants %% carryForward %%',
      '- Alice',
      '- Bob',
      '',
      '### Agenda',
      'Stuff',
      '',
      '### Round table %% carryForward %%',
      '- Updates',
      '',
      '### Notes',
      'More',
    ].join('\n');
    const result = CalendarImporterBase.extractMarkedSections(content);
    expect(result).toContain('### Participants %% carryForward %%\n- Alice\n- Bob');
    expect(result).toContain('### Round table %% carryForward %%\n- Updates');
    // Sections separated by blank line
    expect(result).toBe(
      '### Participants %% carryForward %%\n- Alice\n- Bob\n\n### Round table %% carryForward %%\n- Updates'
    );
  });

  test('returns empty string when no sections are marked', () => {
    const content = '### Agenda\nStuff\n### Notes\nMore';
    expect(CalendarImporterBase.extractMarkedSections(content)).toBe('');
  });

  test('includes sub-headings within marked section', () => {
    const content = '## Section %% carryForward %%\n### Sub\nA\n#### Deep\nB\n## Next';
    const result = CalendarImporterBase.extractMarkedSections(content);
    expect(result).toBe('## Section %% carryForward %%\n### Sub\nA\n#### Deep\nB');
  });

  test('trims trailing blank lines from each section', () => {
    const content = '### A %% carryForward %%\nline 1\n\n\n### B\nline 2';
    const result = CalendarImporterBase.extractMarkedSections(content);
    expect(result).toBe('### A %% carryForward %%\nline 1');
  });

  test('handles marked section at end of document', () => {
    const content = '### Notes\nStuff\n\n### Forward %% carryForward %%\n- Item';
    const result = CalendarImporterBase.extractMarkedSections(content);
    expect(result).toBe('### Forward %% carryForward %%\n- Item');
  });
});

describe('carryForward in full pipeline', () => {
  const RECURRING_ICAL =
    'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260413T090000Z\r\n' +
    'DTEND:20260413T093000Z\r\n' +
    'SUMMARY:Weekly Standup\r\n' +
    'UID:series-001@test\r\n' +
    'RRULE:FREQ=WEEKLY;BYDAY=MO\r\n' +
    'STATUS:CONFIRMED\r\n' +
    'END:VEVENT\r\n' +
    'END:VCALENDAR\r\n';

  const PREVIOUS_NOTE_CONTENT = [
    '---',
    'tags: [Meetings]',
    'uid: series-001@test',
    '---',
    '### Participants',
    '- Alice',
    '- Bob',
    '',
    '### Round table %% carryForward %%',
    '- Status update from Alice',
    '- Blocker discussion',
    '',
    '### Notes',
    'Decision: ship on Friday',
  ].join('\n');

  test('carries forward marked sections from previous note', async () => {
    const scanner = new MockVaultEventScanner([
      {
        uid: 'series-001@test',
        meetingDate: '2026-04-06',
        notePath: 'calendar/2026-04-06 Weekly Standup',
        content: PREVIOUS_NOTE_CONTENT,
      },
    ]);
    const template = '# ${summary}\n${carryForward}';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    expect(importer.writtenFiles).toHaveLength(1);
    const content = importer.writtenFiles[0].content;
    expect(content).toContain('### Round table %% carryForward %%');
    expect(content).toContain('- Status update from Alice');
    expect(content).toContain('- Blocker discussion');
    // Unmarked sections are NOT carried
    expect(content).not.toContain('### Participants');
    expect(content).not.toContain('### Notes');
  });

  test('removes carryForward placeholder when no previous note exists', async () => {
    const scanner = new MockVaultEventScanner([]);
    const template = '# ${summary}\n${carryForward}\n### Notes';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    const content = importer.writtenFiles[0].content;
    expect(content).not.toContain('carryForward');
    expect(content).toContain('### Notes');
  });

  test('removes carryForward placeholder when no marked sections in previous note', async () => {
    const scanner = new MockVaultEventScanner([
      {
        uid: 'series-001@test',
        meetingDate: '2026-04-06',
        notePath: 'calendar/2026-04-06 Weekly Standup',
        content: '### Only This\nSome content',
      },
    ]);
    const template = '# ${summary}\n${carryForward}';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    const content = importer.writtenFiles[0].content;
    expect(content).not.toContain('carryForward');
    expect(content).not.toContain('### Only This');
  });

  test('carries forward multiple marked sections', async () => {
    const prevContent = [
      '### Participants %% carryForward %%',
      '- Alice',
      '- Bob',
      '',
      '### Agenda',
      'Stuff',
      '',
      '### Round table %% carryForward %%',
      '- Updates',
    ].join('\n');

    const scanner = new MockVaultEventScanner([
      {
        uid: 'series-001@test',
        meetingDate: '2026-04-06',
        notePath: 'calendar/2026-04-06 Weekly Standup',
        content: prevContent,
      },
    ]);
    const template = '# ${summary}\n${carryForward}';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    const content = importer.writtenFiles[0].content;
    expect(content).toContain('### Participants %% carryForward %%');
    expect(content).toContain('- Alice');
    expect(content).toContain('### Round table %% carryForward %%');
    expect(content).toContain('- Updates');
    // Unmarked section excluded
    expect(content).not.toContain('### Agenda');
  });

  test('does not carry forward for non-recurring events', async () => {
    const scanner = new MockVaultEventScanner([
      {
        uid: 'test-event-001@outlookcombridge',
        meetingDate: '2026-04-03',
        notePath: 'calendar/2026-04-03 Team Standup',
        content: '### Round table %% carryForward %%\n- Old stuff',
      },
    ]);
    const template = '# ${summary}\n${carryForward}';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    // TEST_ICALENDAR events have no RRULE, so previousEventLink is empty
    await importer.transformICalToTargetFormat(TEST_ICALENDAR);

    for (const file of importer.writtenFiles) {
      expect(file.content).not.toContain('Round table');
      expect(file.content).not.toContain('carryForward');
    }
  });

  test('works with no scanner attached', async () => {
    const template = '# ${summary}\n${carryForward}';
    const importer = new TestCalendarImporter('calendar', template);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    const content = importer.writtenFiles[0].content;
    expect(content).not.toContain('carryForward');
  });

  test('marker is preserved so it chains to subsequent occurrences', async () => {
    const scanner = new MockVaultEventScanner([
      {
        uid: 'series-001@test',
        meetingDate: '2026-04-06',
        notePath: 'calendar/2026-04-06 Weekly Standup',
        content: PREVIOUS_NOTE_CONTENT,
      },
    ]);
    const template = '# ${summary}\n${carryForward}';
    const importer = new TestCalendarImporter('calendar', template, scanner);

    await importer.transformICalToTargetFormat(RECURRING_ICAL);

    const content = importer.writtenFiles[0].content;
    // The %% carryForward %% marker must be present in the output
    // so the next occurrence can also pick it up
    expect(content).toContain('%% carryForward %%');
  });
});

describe('private event filtering', () => {
  const ICAL_WITH_PRIVATE =
    'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260416T090000Z\r\n' +
    'DTEND:20260416T100000Z\r\n' +
    'SUMMARY:Public Meeting\r\n' +
    'UID:public-001@test\r\n' +
    'CLASS:PUBLIC\r\n' +
    'END:VEVENT\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260416T110000Z\r\n' +
    'DTEND:20260416T120000Z\r\n' +
    'SUMMARY:Private Appointment\r\n' +
    'UID:private-001@test\r\n' +
    'CLASS:PRIVATE\r\n' +
    'END:VEVENT\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260416T130000Z\r\n' +
    'DTEND:20260416T140000Z\r\n' +
    'SUMMARY:Confidential Meeting\r\n' +
    'UID:confidential-001@test\r\n' +
    'CLASS:CONFIDENTIAL\r\n' +
    'END:VEVENT\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260416T150000Z\r\n' +
    'DTEND:20260416T160000Z\r\n' +
    'SUMMARY:No Class Event\r\n' +
    'UID:noclass-001@test\r\n' +
    'END:VEVENT\r\n' +
    'END:VCALENDAR\r\n';

  test('excludes PRIVATE and CONFIDENTIAL events when includePrivate is false', async () => {
    const importer = new TestCalendarImporter('calendar', '# ${summary}', undefined, false);
    const result = await importer.transformICalToTargetFormat(ICAL_WITH_PRIVATE);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(2);
    expect(importer.writtenFiles[0].content).toContain('Public Meeting');
    expect(importer.writtenFiles[1].content).toContain('No Class Event');
  });

  test('includes PRIVATE and CONFIDENTIAL events when includePrivate is true', async () => {
    const importer = new TestCalendarImporter('calendar', '# ${summary}', undefined, true);
    const result = await importer.transformICalToTargetFormat(ICAL_WITH_PRIVATE);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(4);
  });

  test('handles case-insensitive CLASS values', async () => {
    const ICAL_LOWERCASE_CLASS =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260416T090000Z\r\n' +
      'DTEND:20260416T100000Z\r\n' +
      'SUMMARY:Public Event\r\n' +
      'UID:pub@test\r\n' +
      'CLASS:public\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';
    const importer = new TestCalendarImporter('calendar', '# ${summary}', undefined, false);
    const result = await importer.transformICalToTargetFormat(ICAL_LOWERCASE_CLASS);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(1);
  });
});

describe('sanitizeFilePath', () => {
  test('replaces colons in filename', () => {
    const result = CalendarImporterBase.sanitizeFilePath('Calendar/2026-04-16 ANNAX OS: Support.md');
    expect(result).toBe('Calendar/2026-04-16 ANNAX OS_ Support.md');
  });

  test('replaces multiple illegal characters in filename', () => {
    const result = CalendarImporterBase.sanitizeFilePath('Dir/Sub/File: "test" <data>.md');
    expect(result).toBe('Dir/Sub/File_ _test_ _data_.md');
  });

  test('does not modify directory separators', () => {
    const result = CalendarImporterBase.sanitizeFilePath('Cal/2026/04/Meeting: Topic.md');
    expect(result).toBe('Cal/2026/04/Meeting_ Topic.md');
  });

  test('handles path without directory separators', () => {
    const result = CalendarImporterBase.sanitizeFilePath('Meeting: Topic.md');
    expect(result).toBe('Meeting_ Topic.md');
  });

  test('leaves clean filenames unchanged', () => {
    const result = CalendarImporterBase.sanitizeFilePath('Calendar/2026-04-16 Standup.md');
    expect(result).toBe('Calendar/2026-04-16 Standup.md');
  });

  test('replaces pipe and asterisk characters', () => {
    const result = CalendarImporterBase.sanitizeFilePath('Dir/File * with | chars.md');
    expect(result).toBe('Dir/File _ with _ chars.md');
  });
});

describe('full-path mode with special characters in summary', () => {
  test('sanitizes colons in summary for file path', async () => {
    const ICAL_COLON_SUMMARY =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260416T090000Z\r\n' +
      'DTEND:20260416T100000Z\r\n' +
      'SUMMARY:ANNAX OS: Cybersecurity & R&D Support\r\n' +
      'UID:colon-001@test\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const importer = new TestCalendarImporter(
      'Calendar/${startDate|yyyy-MM-dd} ${summary}.md',
      '# ${summary}'
    );
    const result = await importer.transformICalToTargetFormat(ICAL_COLON_SUMMARY);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(1);
    expect(importer.writtenFiles[0].filePath).toBe('Calendar/2026-04-16 ANNAX OS_ Cybersecurity & R&D Support.md');
    expect(importer.writtenFiles[0].content).toContain('ANNAX OS: Cybersecurity');
  });

  test('sanitizes 1:1 meeting title in file path', async () => {
    const ICAL_RATIO_SUMMARY =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260416T093000Z\r\n' +
      'DTEND:20260416T100000Z\r\n' +
      'SUMMARY:1:1 Alice - Bob\r\n' +
      'UID:ratio-001@test\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const importer = new TestCalendarImporter(
      'Calendar/Meeting - ${summary}.md',
      '# ${summary}'
    );
    const result = await importer.transformICalToTargetFormat(ICAL_RATIO_SUMMARY);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles[0].filePath).toBe('Calendar/Meeting - 1_1 Alice - Bob.md');
  });

  test('sanitizes slashes in summary so they do not create phantom directories', async () => {
    const ICAL_SLASH_SUMMARY =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260416T140000Z\r\n' +
      'DTEND:20260416T150000Z\r\n' +
      'SUMMARY:Project A/B Review\r\n' +
      'UID:slash-001@test\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const importer = new TestCalendarImporter(
      'Calendar/${startDate|yyyy-MM-dd} ${summary}.md',
      '# ${summary}'
    );
    const result = await importer.transformICalToTargetFormat(ICAL_SLASH_SUMMARY);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(1);
    expect(importer.writtenFiles[0].filePath).toBe('Calendar/2026-04-16 Project A_B Review.md');
    // Content should still contain the original unsanitized summary
    expect(importer.writtenFiles[0].content).toContain('Project A/B Review');
  });

  test('sanitizes backslashes in summary', async () => {
    const ICAL_BACKSLASH =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260416T140000Z\r\n' +
      'DTEND:20260416T150000Z\r\n' +
      'SUMMARY:Team X\\Y Sync\r\n' +
      'UID:backslash-001@test\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const importer = new TestCalendarImporter(
      'Calendar/${startDate|yyyy-MM-dd} ${summary}.md',
      '# ${summary}'
    );
    const result = await importer.transformICalToTargetFormat(ICAL_BACKSLASH);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles[0].filePath).toBe('Calendar/2026-04-16 Team X_Y Sync.md');
  });
});

describe('skip already-imported events', () => {
  const ICAL_TWO_EVENTS =
    'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260416T090000Z\r\n' +
    'DTEND:20260416T100000Z\r\n' +
    'SUMMARY:Morning Standup\r\n' +
    'UID:skip-001@test\r\n' +
    'END:VEVENT\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260416T140000Z\r\n' +
    'DTEND:20260416T150000Z\r\n' +
    'SUMMARY:Afternoon Review\r\n' +
    'UID:skip-002@test\r\n' +
    'END:VEVENT\r\n' +
    'END:VCALENDAR\r\n';

  test('skips events whose file already exists', async () => {
    const importer = new TestCalendarImporter(
      'Calendar/${startDate|yyyy-MM-dd} ${summary}.md',
      '# ${summary}'
    );
    importer.existingFiles.add('Calendar/2026-04-16 Morning Standup.md');

    const result = await importer.transformICalToTargetFormat(ICAL_TWO_EVENTS);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe('1 event(s) imported, 1 already imported');
    expect(importer.writtenFiles).toHaveLength(1);
    expect(importer.writtenFiles[0].filePath).toBe('Calendar/2026-04-16 Afternoon Review.md');
  });

  test('skips all events when all files exist', async () => {
    const importer = new TestCalendarImporter(
      'Calendar/${startDate|yyyy-MM-dd} ${summary}.md',
      '# ${summary}'
    );
    importer.existingFiles.add('Calendar/2026-04-16 Morning Standup.md');
    importer.existingFiles.add('Calendar/2026-04-16 Afternoon Review.md');

    const result = await importer.transformICalToTargetFormat(ICAL_TWO_EVENTS);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe('0 event(s) imported, 2 already imported');
    expect(importer.writtenFiles).toHaveLength(0);
  });

  test('overwrites existing files when forceOverwrite is set', async () => {
    const importer = new TestCalendarImporter(
      'Calendar/${startDate|yyyy-MM-dd} ${summary}.md',
      '# ${summary}'
    );
    importer.existingFiles.add('Calendar/2026-04-16 Morning Standup.md');
    importer.forceOverwrite = true;

    const result = await importer.transformICalToTargetFormat(ICAL_TWO_EVENTS);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe('2 event(s) imported');
    expect(importer.writtenFiles).toHaveLength(2);
  });

  test('imports all events when none exist yet', async () => {
    const importer = new TestCalendarImporter(
      'Calendar/${startDate|yyyy-MM-dd} ${summary}.md',
      '# ${summary}'
    );

    const result = await importer.transformICalToTargetFormat(ICAL_TWO_EVENTS);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe('2 event(s) imported');
    expect(importer.writtenFiles).toHaveLength(2);
  });
});

describe('formatImportSummary', () => {
  test('shows only imported count when nothing skipped', () => {
    expect(CalendarImporterBase.formatImportSummary(3, 0)).toBe('3 event(s) imported');
  });

  test('includes skipped count when events were skipped', () => {
    expect(CalendarImporterBase.formatImportSummary(2, 1)).toBe('2 event(s) imported, 1 already imported');
  });

  test('shows zero imported with skipped count', () => {
    expect(CalendarImporterBase.formatImportSummary(0, 5)).toBe('0 event(s) imported, 5 already imported');
  });
});

