import ICAL from 'ical.js';
import { CalendarEvent } from './CalendarEvent';

/**
 * Parses iCalendar (RFC 5545) strings into flat CalendarEvent objects.
 * Uses ical.js for compliant parsing and handles Outlook-specific quirks
 * like stripped recurrence exception VEVENTs.
 */
export class CalendarEventParser {
  /**
   * Parse an iCalendar string into an array of CalendarEvent objects.
   */
  static parseICalEvents(icalString: string): CalendarEvent[] {
    const jcalData = ICAL.parse(icalString);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    const events = vevents.map((vevent) => {
      const event = new ICAL.Event(vevent);
      return CalendarEventParser.icalEventToCalendarEvent(event, vevent);
    });

    return CalendarEventParser.mergeRecurrenceExceptions(events);
  }

  /**
   * Convert an ICAL.Event + its raw component into a flat CalendarEvent.
   */
  private static icalEventToCalendarEvent(
    event: ICAL.Event,
    vevent: ICAL.Component
  ): CalendarEvent {
    const startDt = event.startDate;
    const endDt = event.endDate;

    const startJs = startDt?.toJSDate();
    const endJs = endDt?.toJSDate();

    // Attendees
    const attendeeProps = vevent.getAllProperties('attendee');
    const attendeeList = attendeeProps.map((prop) => {
      const cn = String(prop.getParameter('cn') ?? '');
      const email = (prop.getFirstValue() ?? '').toString().replace(/^mailto:/i, '');
      return { name: cn || email, email };
    });

    // Organizer
    const organizerProp = vevent.getFirstProperty('organizer');
    let organizer = '';
    if (organizerProp) {
      const cnParam = organizerProp.getParameter('cn');
      organizer = cnParam
        ? String(cnParam)
        : (organizerProp.getFirstValue() ?? '').toString().replace(/^mailto:/i, '');
    }

    return {
      summary: event.summary ?? '',
      description: event.description ?? '',
      location: event.location ?? '',
      startDate: startJs ?? null,
      endDate: endJs ?? null,
      durationMinutes: startJs && endJs ? Math.round((endJs.getTime() - startJs.getTime()) / 60000) : 0,
      uid: event.uid ?? '',
      organizer,
      status: String(vevent.getFirstPropertyValue('status') ?? ''),
      attendees: attendeeList.map((a) => a.name).join(', '),
      attendeeList,
      recurrenceRule: String(vevent.getFirstPropertyValue('rrule') ?? ''),
      recurrenceId: CalendarEventParser.formatRecurrenceId(vevent),
      previousEventLink: '',
      classType: String(vevent.getFirstPropertyValue('class') ?? ''),
      isAllDay: startDt?.isDate === true,
    };
  }

  private static formatRecurrenceId(vevent: ICAL.Component): string {
    const prop = vevent.getFirstProperty('recurrence-id');
    if (!prop) {
      return '';
    }
    const dt = prop.getFirstValue() as any;
    if (dt && typeof dt.toJSDate === 'function') {
      return (dt.toJSDate() as Date).toISOString();
    }
    return String(dt ?? '');
  }

  /**
   * Merge recurrence exception VEVENTs with their series master.
   *
   * Outlook's CalendarSharing exporter emits exception VEVENTs (moved/modified
   * instances of a recurring series) with RECURRENCE-ID but stripped of SUMMARY,
   * DESCRIPTION, ATTENDEE, ORGANIZER, etc. This function copies those fields from
   * the series master (same UID, has recurrenceRule) into the exception when they
   * are empty.
   */
  private static mergeRecurrenceExceptions(events: CalendarEvent[]): CalendarEvent[] {
    // Build a map of series masters: UID → CalendarEvent (has recurrenceRule, no recurrenceId)
    const masters = new Map<string, CalendarEvent>();
    for (const e of events) {
      if (e.recurrenceRule && !e.recurrenceId) {
        masters.set(e.uid, e);
      }
    }

    // Merge missing fields from master into exceptions
    for (const e of events) {
      if (!e.recurrenceId) {
        continue;
      }
      const master = masters.get(e.uid);
      if (!master) {
        continue;
      }

      e.summary = e.summary || master.summary;
      e.description = e.description || master.description;
      e.location = e.location || master.location;
      e.organizer = e.organizer || master.organizer;
      e.attendees = e.attendees || master.attendees;
      e.attendeeList = e.attendeeList.length === 0 ? master.attendeeList : e.attendeeList;
      e.status = e.status || master.status;
      e.recurrenceRule = e.recurrenceRule || master.recurrenceRule;
    }

    return events;
  }
}
