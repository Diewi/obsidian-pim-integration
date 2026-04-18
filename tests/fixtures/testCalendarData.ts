/**
 * Shared test iCalendar data matching C# TestData.TestICalendar.
 * Used by CalendarEvent.test.ts, CalendarImporterBase.test.ts, and
 * BackendOutlookNativeExecutorCli.calendar.test.ts.
 */
export const TEST_ICALENDAR =
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

export const TEST_ICALENDAR_EVENT_COUNT = 3;

/**
 * iCalendar data with attendees, organizer, and status fields populated.
 * Used by CalendarImporterBase tests (real-template tests) and
 * generateCalendarSamples.ts.
 */
export const TEST_ICALENDAR_WITH_ATTENDEES =
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
  'ORGANIZER;CN=Alice Manager:mailto:alice.manager@example.com\r\n' +
  'ATTENDEE;CN=Bob Developer:mailto:bob.dev@example.com\r\n' +
  'ATTENDEE;CN=Charlie Tester:mailto:charlie.test@example.com\r\n' +
  'ATTENDEE;CN=Diana Designer:mailto:diana.design@example.com\r\n' +
  'STATUS:CONFIRMED\r\n' +
  'END:VEVENT\r\n' +
  'BEGIN:VEVENT\r\n' +
  'DTSTART:20260415T140000Z\r\n' +
  'DTEND:20260415T153000Z\r\n' +
  'SUMMARY:Project Review\r\n' +
  'DESCRIPTION:Quarterly project review with stakeholders.\r\n' +
  'LOCATION:Board Room\r\n' +
  'UID:test-event-002@outlookcombridge\r\n' +
  'STATUS:TENTATIVE\r\n' +
  'END:VEVENT\r\n' +
  'BEGIN:VEVENT\r\n' +
  'DTSTART:20260420T110000Z\r\n' +
  'DTEND:20260420T120000Z\r\n' +
  'SUMMARY:Lunch with Müller & Associés\r\n' +
  'DESCRIPTION:Business lunch — discuss Ångström project timeline.\r\n' +
  'LOCATION:Restaurant Königshof, München\r\n' +
  'UID:test-event-003@outlookcombridge\r\n' +
  'ORGANIZER;CN=François Müller:mailto:francois@angstroem.example.com\r\n' +
  'ATTENDEE;CN=François Müller:mailto:francois@angstroem.example.com\r\n' +
  'ATTENDEE;CN=Eva Schmidt:mailto:eva.schmidt@example.com\r\n' +
  'STATUS:CONFIRMED\r\n' +
  'END:VEVENT\r\n' +
  'END:VCALENDAR\r\n';
