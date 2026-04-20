/**
 * Flat, template-friendly representation of a single calendar event.
 * All properties are simple strings/numbers so the existing TemplateEngine
 * can resolve them via ${propertyName} placeholders.
 */
export type CalendarEvent = {
  /** Event summary / title */
  summary: string;
  /** Event description (may contain newlines) */
  description: string;
  /** Location string */
  location: string;
  /** Start date/time — use with pipe transforms: ${startDate|yyyy-MM-dd}, ${startDate|HH:mm} */
  startDate: Date | null;
  /** End date/time — use with pipe transforms: ${endDate|yyyy-MM-dd}, ${endDate|HH:mm} */
  endDate: Date | null;
  /** Duration in minutes */
  durationMinutes: number;
  /** UID of the event */
  uid: string;
  /** Organizer (CN or email) */
  organizer: string;
  /** Status (CONFIRMED, TENTATIVE, CANCELLED) */
  status: string;
  /** Comma-separated list of attendee names/emails */
  attendees: string;
  /** Structured attendee list for array template syntax */
  attendeeList: { name: string; email: string }[];
  /** Raw RRULE string (e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"), empty if non-recurring */
  recurrenceRule: string;
  /**
   * RECURRENCE-ID value as ISO date string. Present only on modified/moved
   * occurrences of a recurring series — identifies the original date slot
   * this occurrence replaces. Empty for normal events and unmodified occurrences.
   */
  recurrenceId: string;
  /**
   * Wikilink to the previous occurrence's note (e.g. "[[2026-04-06 Weekly Standup]]").
   * Populated during import by scanning the vault for earlier notes with the same UID.
   * Empty if no previous occurrence note exists or the event is not recurring.
   */
  previousEventLink: string;
  /**
   * CLASS property from iCal (PUBLIC, PRIVATE, CONFIDENTIAL).
   * Used to filter private events when the user opts out of importing them.
   */
  classType: string;
  /** True when the event uses a DATE-only start (no time component), i.e. an all-day event. */
  isAllDay: boolean;
};
