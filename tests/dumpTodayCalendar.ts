/**
 * Diagnostic helper: export today's raw iCal from Outlook via OutlookComBridge CLI,
 * then parse and analyse each VEVENT.
 *
 * Usage:  npx ts-node tests/dumpTodayCalendar.ts
 * Output: tests/test-output/calendar-dump/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { native_bridge } from '../src_generated/native_bridge';
import { CalendarEvent } from '../src/calendar/CalendarEvent';
import { CalendarEventParser } from '../src/calendar/CalendarEventParser';

const parseICalEvents = CalendarEventParser.parseICalEvents;

const OUTPUT_DIR = path.resolve(__dirname, 'test-output', 'calendar-dump');

// .NET ticks conversion (same as BackendOutlookNativeExecutorCLI)
function dateToTicks(dateMs: number): number {
  const DOTNET_EPOCH_OFFSET_S = 62135596800;
  const TICKS_PER_S = 10000000;
  const TICKS_PER_MS = 10000;
  return DOTNET_EPOCH_OFFSET_S * TICKS_PER_S + dateMs * TICKS_PER_MS;
}

async function main() {
  // Today's boundaries (local time, exclusive end = start of next day)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

  console.log(`Date range: ${startOfDay.toISOString()} — ${startOfNextDay.toISOString()}`);

  // Build protobuf request
  const request: native_bridge.ICliRequest = {
    calendarExport: {
      startDate: dateToTicks(startOfDay.getTime()),
      endDate: dateToTicks(startOfNextDay.getTime()),
      includePrivate: true,
      calendarFolder: '',
    },
  };
  const requestBuf = native_bridge.CliRequest.encode(request).finish();

  // Locate OutlookComBridge
  const comBridgePath = path.resolve(__dirname, '..', 'dist_outlookcombridge');
  const exePath = path.join(comBridgePath, 'OutlookComBridge.exe');
  if (!fs.existsSync(exePath)) {
    console.error(`OutlookComBridge.exe not found at: ${exePath}`);
    process.exit(1);
  }

  console.log(`Calling: ${exePath} export-calendar`);

  // Spawn CLI
  const result = await new Promise<Buffer>((resolve, reject) => {
    const proc = child_process.spawn(exePath, ['export-calendar'], {
      cwd: comBridgePath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const chunks: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.stderr.on('data', (c: Buffer) => process.stderr.write(c));
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`CLI exited with code ${code}`));
      else resolve(Buffer.concat(chunks));
    });
    proc.on('error', reject);

    // Send request via stdin
    proc.stdin.end(Buffer.from(requestBuf));
  });

  // Decode length-prefixed protobuf response
  if (result.length < 4) {
    console.error('Response too short');
    process.exit(1);
  }
  const payloadLen = result.readUInt32LE(0);
  const payload = result.subarray(4, 4 + payloadLen);
  const response = native_bridge.CliResponse.decode(payload);

  if (!response.success) {
    console.error(`CLI error: ${response.errorMessage}`);
    process.exit(1);
  }

  const ical = response.exportResult?.calendar?.ical;
  if (!ical) {
    console.error('No calendar data in response');
    process.exit(1);
  }

  // Write raw iCal
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const icalPath = path.join(OUTPUT_DIR, 'raw-today.ics');
  fs.writeFileSync(icalPath, ical, 'utf-8');
  console.log(`\nRaw iCal written to: ${icalPath}`);
  console.log(`Event count (from CLI): ${response.exportResult?.calendar?.eventCount}`);

  // Parse with ical.js
  const events = parseICalEvents(ical);
  console.log(`Events parsed by ical.js: ${events.length}\n`);

  // Analyse each event
  console.log('='.repeat(100));
  console.log('EVENT ANALYSIS');
  console.log('='.repeat(100));

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const startStr = e.startDate ? e.startDate.toISOString() : '(null)';
    const endStr = e.endDate ? e.endDate.toISOString() : '(null)';
    const isToday = e.startDate
      ? e.startDate >= startOfDay && e.startDate < startOfNextDay
      : false;

    console.log(`\n[${i + 1}] ${e.summary || '(empty summary)'}`);
    console.log(`    Start:      ${startStr}`);
    console.log(`    End:        ${endStr}`);
    console.log(`    Duration:   ${e.durationMinutes} min`);
    console.log(`    UID:        ${e.uid}`);
    console.log(`    Status:     ${e.status}`);
    console.log(`    Location:   ${e.location || '(none)'}`);
    console.log(`    Organizer:  ${e.organizer || '(none)'}`);
    console.log(`    Attendees:  ${e.attendees || '(none)'}`);
    console.log(`    Recurrence: ${e.recurrenceRule || '(none)'}`);
    console.log(`    Recur-ID:   ${e.recurrenceId || '(none)'}`);
    console.log(`    Is today:   ${isToday ? 'YES' : 'NO'}`);
  }

  // Summary: group by "is today"
  const todayEvents = events.filter(
    (e: CalendarEvent) => e.startDate && e.startDate >= startOfDay && e.startDate < startOfNextDay
  );
  const otherEvents = events.filter(
    (e: CalendarEvent) => !e.startDate || e.startDate < startOfDay || e.startDate >= startOfNextDay
  );

  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  console.log(`Total VEVENTs in iCal:       ${events.length}`);
  console.log(`Events starting today:       ${todayEvents.length}`);
  console.log(`Events NOT starting today:   ${otherEvents.length}`);
  
  if (otherEvents.length > 0) {
    console.log('\nEvents NOT on today:');
    for (const e of otherEvents) {
      const startStr = e.startDate ? e.startDate.toISOString() : '(null)';
      console.log(`  - [${startStr}] ${e.summary || '(empty)'} (UID: ${e.uid})`);
    }
  }

  // Check for duplicate UIDs (recurring series master + exceptions)
  const uidCounts = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!uidCounts.has(e.uid)) uidCounts.set(e.uid, []);
    uidCounts.get(e.uid)!.push(e);
  }
  const duplicateUids = [...uidCounts.entries()].filter(([, v]) => v.length > 1);
  if (duplicateUids.length > 0) {
    console.log('\nDuplicate UIDs (recurring series/exceptions):');
    for (const [uid, evts] of duplicateUids) {
      console.log(`  UID: ${uid} (${evts.length} VEVENTs)`);
      for (const e of evts) {
        const startStr = e.startDate ? e.startDate.toISOString() : '(null)';
        console.log(`    - [${startStr}] ${e.summary || '(empty)'} recurrenceRule=${e.recurrenceRule || 'none'} recurrenceId=${e.recurrenceId || 'none'}`);
      }
    }
  }

  // Check for events that would produce empty filenames
  const emptyNames = events.filter((e: CalendarEvent) => !e.summary);
  if (emptyNames.length > 0) {
    console.log('\nEvents with empty summary (would produce bad filenames):');
    for (const e of emptyNames) {
      console.log(`  - UID: ${e.uid}, start: ${e.startDate?.toISOString()}`);
    }
  }

  // Write per-event JSON for offline analysis
  const eventsJsonPath = path.join(OUTPUT_DIR, 'parsed-events.json');
  fs.writeFileSync(eventsJsonPath, JSON.stringify(events, null, 2), 'utf-8');
  console.log(`\nParsed events JSON: ${eventsJsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
