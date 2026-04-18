import { CalendarEvent } from '../src/calendar/CalendarEvent';
import { CalendarEventParser } from '../src/calendar/CalendarEventParser';

const parseICalEvents = CalendarEventParser.parseICalEvents;
import { TEST_ICALENDAR } from './fixtures/testCalendarData';

describe('parseICalEvents', () => {
  let events: CalendarEvent[];

  beforeAll(() => {
    events = parseICalEvents(TEST_ICALENDAR);
  });

  test('parses correct number of events', () => {
    expect(events).toHaveLength(3);
  });

  test('parses event summaries', () => {
    expect(events[0].summary).toBe('Team Standup');
    expect(events[1].summary).toBe('Project Review');
    expect(events[2].summary).toBe('Lunch with Müller & Associés');
  });

  test('parses event descriptions', () => {
    expect(events[0].description).toBe('Daily standup meeting with the engineering team.');
    expect(events[1].description).toBe('Quarterly project review with stakeholders.');
    expect(events[2].description).toBe('Business lunch — discuss Ångström project timeline.');
  });

  test('parses event locations', () => {
    expect(events[0].location).toBe('Conference Room A');
    expect(events[1].location).toBe('Board Room');
    expect(events[2].location).toBe('Restaurant Königshof, München');
  });

  test('parses event UIDs', () => {
    expect(events[0].uid).toBe('test-event-001@outlookcombridge');
    expect(events[1].uid).toBe('test-event-002@outlookcombridge');
    expect(events[2].uid).toBe('test-event-003@outlookcombridge');
  });

  test('parses startDate as Date objects', () => {
    expect(events[0].startDate).toBeInstanceOf(Date);
    expect(events[1].startDate).toBeInstanceOf(Date);
    expect(events[2].startDate).toBeInstanceOf(Date);
    expect(events[0].startDate!.toISOString()).toBe('2026-04-10T09:00:00.000Z');
    expect(events[1].startDate!.toISOString()).toBe('2026-04-15T14:00:00.000Z');
    expect(events[2].startDate!.toISOString()).toBe('2026-04-20T11:00:00.000Z');
  });

  test('parses endDate as Date objects', () => {
    expect(events[0].endDate).toBeInstanceOf(Date);
    expect(events[1].endDate).toBeInstanceOf(Date);
    expect(events[2].endDate).toBeInstanceOf(Date);
    expect(events[0].endDate!.toISOString()).toBe('2026-04-10T10:00:00.000Z');
    expect(events[1].endDate!.toISOString()).toBe('2026-04-15T15:30:00.000Z');
    expect(events[2].endDate!.toISOString()).toBe('2026-04-20T12:00:00.000Z');
  });

  test('computes duration in minutes', () => {
    expect(events[0].durationMinutes).toBe(60);
    expect(events[1].durationMinutes).toBe(90);
    expect(events[2].durationMinutes).toBe(60);
  });

  test('populates startDate and endDate as Date objects', () => {
    expect(events[0].startDate).toBeInstanceOf(Date);
    expect(events[0].endDate).toBeInstanceOf(Date);
    expect(events[0].startDate!.toISOString()).toBe('2026-04-10T09:00:00.000Z');
    expect(events[0].endDate!.toISOString()).toBe('2026-04-10T10:00:00.000Z');
  });

  test('handles empty attendees and organizer', () => {
    // Test data has no attendees or organizer
    for (const event of events) {
      expect(event.attendees).toBe('');
      expect(event.attendeeList).toEqual([]);
      expect(event.organizer).toBe('');
    }
  });

  test('handles empty status', () => {
    for (const event of events) {
      expect(event.status).toBe('');
    }
  });

  test('returns empty recurrenceRule for non-recurring events', () => {
    for (const event of events) {
      expect(event.recurrenceRule).toBe('');
    }
  });

  test('returns empty recurrenceId for events without RECURRENCE-ID', () => {
    for (const event of events) {
      expect(event.recurrenceId).toBe('');
    }
  });

  test('initializes previousEventLink as empty string', () => {
    for (const event of events) {
      expect(event.previousEventLink).toBe('');
    }
  });
});

describe('parseICalEvents with attendees', () => {
  const ICAL_WITH_ATTENDEES =
    'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260501T100000Z\r\n' +
    'DTEND:20260501T110000Z\r\n' +
    'SUMMARY:Meeting with Attendees\r\n' +
    'UID:attendee-test@test\r\n' +
    'ORGANIZER;CN=Boss Man:mailto:boss@example.com\r\n' +
    'ATTENDEE;CN=Alice;RSVP=TRUE:mailto:alice@example.com\r\n' +
    'ATTENDEE;CN=Bob:mailto:bob@example.com\r\n' +
    'STATUS:CONFIRMED\r\n' +
    'END:VEVENT\r\n' +
    'END:VCALENDAR\r\n';

  test('parses organizer', () => {
    const events = parseICalEvents(ICAL_WITH_ATTENDEES);
    expect(events[0].organizer).toBe('Boss Man');
  });

  test('parses attendee list', () => {
    const events = parseICalEvents(ICAL_WITH_ATTENDEES);
    expect(events[0].attendeeList).toEqual([
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ]);
  });

  test('creates comma-separated attendees string', () => {
    const events = parseICalEvents(ICAL_WITH_ATTENDEES);
    expect(events[0].attendees).toBe('Alice, Bob');
  });

  test('parses status', () => {
    const events = parseICalEvents(ICAL_WITH_ATTENDEES);
    expect(events[0].status).toBe('CONFIRMED');
  });
});

describe('parseICalEvents edge cases', () => {
  test('returns empty array for calendar with no events', () => {
    const emptyCalendar =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'END:VCALENDAR\r\n';
    expect(parseICalEvents(emptyCalendar)).toEqual([]);
  });

  test('handles unicode characters in all fields', () => {
    const events = parseICalEvents(TEST_ICALENDAR);
    const unicodeEvent = events[2];
    expect(unicodeEvent.summary).toContain('Müller');
    expect(unicodeEvent.summary).toContain('Associés');
    expect(unicodeEvent.description).toContain('Ångström');
    expect(unicodeEvent.location).toContain('Königshof');
    expect(unicodeEvent.location).toContain('München');
  });
});

describe('parseICalEvents with recurrence rule', () => {
  const ICAL_WITH_RRULE =
    'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260413T090000Z\r\n' +
    'DTEND:20260413T093000Z\r\n' +
    'SUMMARY:Weekly Standup\r\n' +
    'UID:recurring-001@test\r\n' +
    'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231T235959Z\r\n' +
    'END:VEVENT\r\n' +
    'END:VCALENDAR\r\n';

  test('parses RRULE into recurrenceRule string', () => {
    const events = parseICalEvents(ICAL_WITH_RRULE);
    expect(events).toHaveLength(1);
    expect(events[0].recurrenceRule).toContain('FREQ=WEEKLY');
    expect(events[0].recurrenceRule).toContain('BYDAY=MO,WE,FR');
  });

  test('mixed recurring and non-recurring events', () => {
    const ICAL_MIXED =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260413T090000Z\r\n' +
      'DTEND:20260413T100000Z\r\n' +
      'SUMMARY:Recurring Meeting\r\n' +
      'UID:recurring-002@test\r\n' +
      'RRULE:FREQ=DAILY;COUNT=5\r\n' +
      'END:VEVENT\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260415T140000Z\r\n' +
      'DTEND:20260415T150000Z\r\n' +
      'SUMMARY:One-off Meeting\r\n' +
      'UID:single-001@test\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const events = parseICalEvents(ICAL_MIXED);
    expect(events).toHaveLength(2);
    expect(events[0].recurrenceRule).toContain('FREQ=DAILY');
    expect(events[0].recurrenceRule).toContain('COUNT=5');
    expect(events[1].recurrenceRule).toBe('');
  });
});

describe('parseICalEvents with RECURRENCE-ID', () => {
  test('parses RECURRENCE-ID into recurrenceId as ISO string', () => {
    const ICAL_WITH_RECURRENCE_ID =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260415T100000Z\r\n' +
      'DTEND:20260415T110000Z\r\n' +
      'SUMMARY:Moved Standup\r\n' +
      'UID:recurring-series@test\r\n' +
      'RECURRENCE-ID:20260413T090000Z\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const events = parseICalEvents(ICAL_WITH_RECURRENCE_ID);
    expect(events).toHaveLength(1);
    expect(events[0].recurrenceId).toBe('2026-04-13T09:00:00.000Z');
    expect(events[0].startDate!.toISOString()).toContain('2026-04-15');
  });

  test('returns empty recurrenceId for normal occurrences', () => {
    const ICAL_NO_RECURRENCE_ID =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260413T090000Z\r\n' +
      'DTEND:20260413T100000Z\r\n' +
      'SUMMARY:Regular Standup\r\n' +
      'UID:recurring-series@test\r\n' +
      'RRULE:FREQ=WEEKLY;BYDAY=MO\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const events = parseICalEvents(ICAL_NO_RECURRENCE_ID);
    expect(events[0].recurrenceId).toBe('');
  });
});

// TODO: Fill this testcase with artificial data. This data is taken from an actual event in my calendar.
describe('mergeRecurrenceExceptions', () => {
  // Simulates Outlook CalendarSharing export: series master + stripped exception
  const ICAL_MASTER_AND_EXCEPTION =
    'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260414T143000Z\r\n' +
    'DTEND:20260414T150000Z\r\n' +
    'SUMMARY:1:1 Alex - Tobias\r\n' +
    'DESCRIPTION:Weekly sync.\r\n' +
    'LOCATION:Teams Room\r\n' +
    'UID:recurring-weekly@test\r\n' +
    'RRULE:FREQ=WEEKLY;BYDAY=TU\r\n' +
    'ORGANIZER;CN=Tobias:mailto:tobias@example.com\r\n' +
    'ATTENDEE;CN=Tobias:mailto:tobias@example.com\r\n' +
    'ATTENDEE;CN=Alex:mailto:alex@example.com\r\n' +
    'STATUS:CONFIRMED\r\n' +
    'END:VEVENT\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:20260416T093000Z\r\n' +
    'DTEND:20260416T100000Z\r\n' +
    'UID:recurring-weekly@test\r\n' +
    'RECURRENCE-ID:20260414T143000Z\r\n' +
    'END:VEVENT\r\n' +
    'END:VCALENDAR\r\n';

  test('copies summary from master to exception', () => {
    const events = parseICalEvents(ICAL_MASTER_AND_EXCEPTION);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception).toBeDefined();
    expect(exception!.summary).toBe('1:1 Alex - Tobias');
  });

  test('copies description from master to exception', () => {
    const events = parseICalEvents(ICAL_MASTER_AND_EXCEPTION);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception!.description).toBe('Weekly sync.');
  });

  test('copies location from master to exception', () => {
    const events = parseICalEvents(ICAL_MASTER_AND_EXCEPTION);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception!.location).toBe('Teams Room');
  });

  test('copies organizer from master to exception', () => {
    const events = parseICalEvents(ICAL_MASTER_AND_EXCEPTION);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception!.organizer).toBe('Tobias');
  });

  test('copies attendees from master to exception', () => {
    const events = parseICalEvents(ICAL_MASTER_AND_EXCEPTION);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception!.attendees).toBe('Tobias, Alex');
    expect(exception!.attendeeList).toEqual([
      { name: 'Tobias', email: 'tobias@example.com' },
      { name: 'Alex', email: 'alex@example.com' },
    ]);
  });

  test('copies status from master to exception', () => {
    const events = parseICalEvents(ICAL_MASTER_AND_EXCEPTION);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception!.status).toBe('CONFIRMED');
  });

  test('copies recurrenceRule from master to exception', () => {
    const events = parseICalEvents(ICAL_MASTER_AND_EXCEPTION);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception!.recurrenceRule).toContain('FREQ=WEEKLY');
  });

  test('preserves exception own startDate (moved date)', () => {
    const events = parseICalEvents(ICAL_MASTER_AND_EXCEPTION);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception!.startDate!.toISOString()).toBe('2026-04-16T09:30:00.000Z');
  });

  test('does not overwrite exception fields that are already set', () => {
    const ICAL_EXCEPTION_WITH_OWN_SUMMARY =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260414T143000Z\r\n' +
      'DTEND:20260414T150000Z\r\n' +
      'SUMMARY:Original Title\r\n' +
      'UID:override-test@test\r\n' +
      'RRULE:FREQ=WEEKLY;BYDAY=TU\r\n' +
      'END:VEVENT\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260416T093000Z\r\n' +
      'DTEND:20260416T100000Z\r\n' +
      'SUMMARY:Overridden Title\r\n' +
      'UID:override-test@test\r\n' +
      'RECURRENCE-ID:20260414T143000Z\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const events = parseICalEvents(ICAL_EXCEPTION_WITH_OWN_SUMMARY);
    const exception = events.find((e) => e.recurrenceId !== '');
    expect(exception!.summary).toBe('Overridden Title');
  });

  test('handles exception without matching master (orphan)', () => {
    const ICAL_ORPHAN_EXCEPTION =
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'BEGIN:VEVENT\r\n' +
      'DTSTART:20260416T093000Z\r\n' +
      'DTEND:20260416T100000Z\r\n' +
      'UID:orphan@test\r\n' +
      'RECURRENCE-ID:20260414T143000Z\r\n' +
      'END:VEVENT\r\n' +
      'END:VCALENDAR\r\n';

    const events = parseICalEvents(ICAL_ORPHAN_EXCEPTION);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('');
  });
});
