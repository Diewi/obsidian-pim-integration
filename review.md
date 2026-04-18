# Code Review — Calendar Import Feature

## Purpose

This document describes all uncommitted changes for the calendar import feature of the
Obsidian PIM Integration plugin. It is intended as input for a code review by an AI agent.
The reviewer should verify correctness, consistency, error handling, test coverage and
adherence to the existing codebase style.

## Change Scope

**24 modified files, 11 new files — approx. 900 insertions, 40 deletions.**

### New files

| File | Purpose |
|------|---------|
| `src/calendar/CalendarEvent.ts` | Flat `CalendarEvent` interface + iCal parser (`parseICalEvents`) using `ical.js`; `classType` field parsed from iCal `CLASS`; `mergeRecurrenceExceptions()` copies missing fields from series master to stripped exception VEVENTs |
| `src/calendar/CalendarImporter.ts` | `ICalendarImporter` interface (contract for import pipeline) |
| `src/calendar/CalendarImporterBase.ts` | Abstract base: template substitution, file path resolution, carryForward, previousEventLink; `includePrivate` constructor param with `CLASS:PRIVATE`/`CLASS:CONFIDENTIAL` filtering; optional `startDate`/`endDate` date range filtering in `transformICalToTargetFormat`; `sanitizeFilePath()` for invalid filename chars; success message uses `importedCount` (actual writes); error message includes failed event summaries |
| `src/calendar/CalendarImporterMarkdown.ts` | Obsidian-concrete subclass — writes via `vault.adapter.write()`; passes `includePrivate` to base |
| `src/calendar/ICalendarImporterBackend.ts` | `ICalendarImporterBackend` interface (backend provides iCal string) |
| `src/calendar/IVaultEventScanner.ts` | Interface: `findPreviousOccurrenceNote()`, `readNoteContent()` |
| `src/calendar/ObsidianVaultEventScanner.ts` | Implementation scanning `metadataCache` for UID/meetingDate frontmatter |
| `src/gui/calendarModals.ts` | `PimIntegrationImportCalendar` — orchestrates calendar import for a date/range; passes `includePrivateCalendarEvents` setting to importer |
| `src/gui/datePickerModal.ts` | `DatePickerModal` — Obsidian Modal with `<input type="date">`, returns `Promise<Date \| null>` |
| `src/gui/inputValidator.ts` | `InputValidator` — generic debounced validation hint for settings inputs |
| `src/pimbackend/ICalendarBackend.ts` | `ICalendarBackend` interface (backend that can create a calendar importer backend) |
| `src/pimbackend/outlook/CalendarImporterBackendOutlook.ts` | Outlook-specific calendar backend implementation; `includePrivate` param passed through to CLI executor's `exportCalendar()` |
| `tests/CalendarEvent.test.ts` | Unit tests for `parseICalEvents` |
| `tests/CalendarImporterBase.test.ts` | 76 tests for the import pipeline (transforms, paths, carryForward, previousEventLink) |
| `tests/MarkdownCalendarTemplate.md` | Sample template used by tests and as reference for users |
| `tests/generateCalendarSamples.ts` | Script writing sample calendar events to disk for manual verification |
| `tests/dumpTodayCalendar.ts` | Diagnostic script exporting raw iCal from Outlook for a given day (writes `raw-today.ics`, `parsed-events.json`) |

### Modified files

| File | Summary of changes |
|------|-------------------|
| `src/main.ts` | New `import-calendar-today` and `import-calendar-date` commands using `DatePickerModal`; applies `includePrivateCalendarEvents` setting to backend on load |
| `src/settings.ts` | Added `calendarFolderPath`, `calendarTemplate`, `outlookCalendarName`, `includePrivateCalendarEvents` to settings interface + defaults |
| `src/gui/settingsController.ts` | Section headings (h3: Backend/Contacts/Calendar), Calendar Event Path setting with `InputValidator`, `validateTemplatePath()` logic, Outlook Calendar Folder setting, Include Private Calendar Events toggle |
| `src/contacts/TemplateEngine.ts` | Pipe transform for `Date` values using `date-fns` + `@date-fns/utc` (`${prop\|format}`) |
| `src/pimbackend/outlook/BackendTypeOutlook.ts` | Implements `ICalendarBackend.createCalendarImporter()`; `includePrivateCalendarEvents` field + setter, passes to `CalendarImporterBackendOutlook` |
| `src/pimbackend/outlook/IBackendOutlookNativeExecutor.ts` | New `exportCalendar()` method on executor interface |
| `src/pimbackend/outlook/BackendOutlookNativeExecutorCLI.ts` | CLI executor: `exportCalendar()` via `ExportCalendarCommand` |
| `src/pimbackend/outlook/BackendOutlookNativeExecutorEdge.ts` | Edge executor: `exportCalendar()` stub |
| `src/pimbackend/outlook/EdgeOutlookNativeExecutor.ts` | Edge native executor: `exportCalendar()` stub |
| `src_native/outlookcombridge/Commands/ExportCalendarCommand.cs` | New C# CLI command fetching Outlook calendar via COM interop |
| `src_native/outlookcombridge/OutlookCalendarBridge.cs` | C# class reading calendar items and serialising to iCal |
| `src_native/outlookcombridge/proto/NativeBridge.cs` | Updated protobuf bindings |
| `src_native/proto/native_bridge.proto` | New `ExportCalendarRequest`/`ExportCalendarResponse` messages |
| `package.json` / `package-lock.json` | Added `ical.js`, `date-fns`, `@date-fns/utc` dependencies |
| `tests/BackendOutlookNativeExecutorCli.calendar.test.ts` | Tests for CLI calendar export integration |
| `tests/TemplateEngine.test.ts` | New tests for pipe transforms and UTC date formatting |

## Architecture Overview

```
 User Command (main.ts)
       │
       ▼
 DatePickerModal ─► PimIntegrationImportCalendar (calendarModals.ts)
                           │
                           ├─ reads template from vault
                           ├─ creates CalendarImporterMarkdown
                           └─ calls transformCalendarEvents()
                                    │
                                    ▼
                   ICalendarImporterBackend.getCalendarEvents()
                   (CLI → C# COM interop → iCal string)
                                    │
                                    ▼
                   CalendarImporterBase.transformICalToTargetFormat()
                     parseICalEvents() + mergeRecurrenceExceptions()
                     filter by date range (startDate/endDate)
                     filter private/confidential (if includePrivate off)
                     for each CalendarEvent:
                       1. resolvePreviousEventLink()   ← vault scan
                       2. resolveCarryForward()         ← reads prev note
                       3. transformSingleEvent()        ← TemplateEngine
                       4. resolveFilePath()             ← dir or full-path + sanitize
                       5. writeToFile()                 ← vault.adapter.write
```

## Areas to Review

### 1. CalendarImporterBase (core logic)

- **Async pipeline**: `transformICalToTargetFormat` is async because `resolveCarryForward` reads
  vault content. Verify all callers properly await the result.
- **Date range filtering**: Optional `startDate`/`endDate` params filter events to
  `startDate <= event.startDate < endDate`. Verify boundary conditions (all-day events, null dates).
- **Private event filtering**: When `includePrivate` is false, events with `CLASS:PRIVATE` or
  `CLASS:CONFIDENTIAL` are silently excluded after parsing. This is necessary because Outlook's
  COM-level `IncludePrivateDetails=false` strips details but still exports the VEVENT itself.
- **File path resolution**: Two modes — folder-only (`Resources/Calendar`) auto-generates filename
  from date + summary; full-path mode (ending `.md`) treats the entire setting as a path template.
  Ensure edge cases (missing summary, null dates) are handled.
- **Filename sanitization**: `sanitizeFilePath()` replaces `\ : * ? " < > |` in the filename
  portion (after last `/`) with `_`. Applied only in full-path mode. Verify it does not affect
  the directory portion of the path.
- **Import count / failure reporting**: Success message uses `importedCount` (actual writes) not
  `events.length` (total parsed). Error message includes summaries of failed events.
- **CarryForward**: `%% carryForward %%` markers in headings are detected via regex. The marker
  is preserved in carried-forward content to enable automatic chaining across recurring events.
  Check that the regex is robust against edge cases (marker mid-line, multiple markers on same
  heading, nested headings).
- **extractMarkedSections / extractSection**: Static methods doing line-based markdown parsing.
  Verify heading level comparison logic (equal-or-higher stops the section).

### 2. CalendarEvent + parseICalEvents

- Uses `ical.js` for RFC 5545 parsing. The `CalendarEvent` interface is intentionally flat
  (no nested objects except `attendeeList`) so the TemplateEngine can substitute directly.
- `startDate` / `endDate` are `Date | null`. The template engine's pipe transform handles
  `null` cleanly (produces empty string). Verify this in all code paths.
- `classType` field parsed from iCal `CLASS` property (PUBLIC, PRIVATE, CONFIDENTIAL).
- `mergeRecurrenceExceptions()` is called at the end of `parseICalEvents()`. It builds a
  UID→master map and copies summary/description/location/organizer/attendees/attendeeList/
  status/recurrenceRule from the series master to stripped exception VEVENTs (same UID, has
  `recurrenceId`, empty summary). Verify: handles orphan exceptions (no matching master)
  gracefully; does not overwrite exception fields that are already set.

### 3. TemplateEngine — pipe transforms

- New code path: when `value instanceof Date`, apply `dateFnsFormat(new UTCDate(value), formatStr)`.
- Uses `@date-fns/utc` (`UTCDate`) to ensure consistent UTC-based formatting regardless of the
  host timezone. Verify this is the correct semantic — Outlook COM returns local time dates, which
  are then converted to JS `Date` (inherently UTC internally). Confirm that `UTCDate` wrapping
  does not shift the displayed time.

### 4. Date boundary in calendarModals.ts

- Start: `new Date(year, month, date, 0, 0, 0)` — local midnight.
- End: `new Date(year, month, date + 1, 0, 0, 0)` — local midnight next day (exclusive).
- Outlook COM operates in local time, so local boundaries are correct.
- Verify: JS `Date` constructor handles month rollover (e.g. Jan 31 + 1 day) correctly.

### 5. DatePickerModal

- Double-resolution guard: `this.resolve = () => {}` before calling `this.close()` in `submit()`.
- `onClose()` always calls `this.resolve(null)` — after submit the reference is already replaced
  with a no-op, so this is safe.
- The date is parsed as `new Date(value + 'T00:00:00Z')` — i.e. parsed as UTC midnight. Verify
  this does not cause off-by-one in local-time-based downstream code.

### 6. InputValidator

- DOM placement: inserted after `.setting-item` via `insertAdjacentElement('afterend')`.
- 300ms debounce; runs initial validation on construction (catches pre-filled invalid values).
- Verify: hint element cleanup on settings tab teardown (currently not explicitly removed).

### 7. Settings validation (`validateTemplatePath`)

- Sample substitution with `{ startDate, endDate }` to test path resolution.
- Checks for `//` (empty segments) and remaining `${` (unresolvable placeholders).
- Full-path mode: requires `${...}` in filename to ensure unique event files.
- Wrapped in try/catch for bad format strings.

### 8. ObsidianVaultEventScanner

- `findPreviousOccurrenceNote`: scans all `.md` files under `baseDir`, checks UID in frontmatter,
  finds latest `meetingDate` before the target. Linear scan — may be slow in large vaults.
  Consider whether this needs optimisation or caching.
- `readNoteContent`: finds file by basename (not full path) in scoped directory, reads via
  `vault.read()`. Verify uniqueness assumption (two files with same basename in different sub-dirs).

### 9. C# / Protobuf changes

- `ExportCalendarCommand.cs` and `OutlookCalendarBridge.cs` — C# COM interop reading Outlook
  calendar items. Verify COM object cleanup (`Marshal.ReleaseComObject` or `using` patterns).
- `native_bridge.proto`: new `ExportCalendarRequest` / `ExportCalendarResponse`. Verify backward
  compatibility with existing contact export messages.

### 10. Test coverage

- `CalendarImporterBase.test.ts`: ~124 tests covering the pipeline, path resolution, carryForward,
  previousEventLink, extractSection, extractMarkedSections, date range filtering, private event
  filtering, filename sanitization.
- `CalendarEvent.test.ts`: iCal parsing tests + `mergeRecurrenceExceptions` tests (8 tests).
- `TemplateEngine.test.ts`: new pipe transform tests.
- `BackendOutlookNativeExecutorCli.calendar.test.ts`: CLI integration tests.
- `dumpTodayCalendar.ts`: diagnostic script (not an automated test) for raw iCal inspection.
- **Total**: ~166 calendar-related tests.
- **Missing**: No direct test for `DatePickerModal`, `InputValidator`, `calendarModals.ts`
  (these are Obsidian UI classes that are hard to unit-test without mocking the full Obsidian API,
  but worth noting).

## Potential Issues / Questions

1. **UTCDate vs local time**: Outlook COM returns local-time dates. `parseICalEvents` converts them
   to JS `Date` (which stores UTC internally). The template engine then wraps in `UTCDate` for
   formatting. If a meeting starts at 10:00 local time and local offset is +2h, the `Date` object
   holds 08:00 UTC. `UTCDate` formatting would display 08:00, not 10:00. Is this intended?

2. **Vault scanner performance**: `findPreviousOccurrenceNote` does a linear scan of all markdown
   files. For vaults with thousands of calendar notes this could be slow. Acceptable for now?

3. **Hint element lifecycle**: `InputValidator` inserts a DOM element but never removes it. If
   `display()` is called again (settings tab re-render), hint elements may accumulate. The
   `containerEl.empty()` call in `display()` removes the setting items, but the hint is inserted
   *after* the setting item — verify it is also removed by `empty()`.

4. **CarryForward chaining depth**: If a user has years of weekly meetings, the carryForward
   content can grow unboundedly. Is there a practical limit or truncation needed?

5. **File collision**: In folder-only mode, filename is `YYYY-MM-DD Summary.md`. Two events on
   the same day with the same summary would overwrite each other silently. In full-path mode,
   `sanitizeFilePath()` replaces `\ : * ? " < > |` with `_`, which prevents file-system errors
   but could theoretically cause two differently-named events to map to the same sanitized filename.

6. **Dual private-event filtering**: Private events are filtered at two levels — the C# COM
   interop strips details via `IncludePrivateDetails`, and the TypeScript layer filters out
   `CLASS:PRIVATE`/`CLASS:CONFIDENTIAL` VEVENTs. The COM-level flag alone is insufficient
   (Outlook still exports the VEVENT with `CLASS:PRIVATE`). Verify the two layers do not
   contradict each other when `includePrivate` is toggled on.

7. **Recurrence exception merging edge cases**: `mergeRecurrenceExceptions()` copies fields
   from the series master to stripped exceptions. If a series master is outside the requested
   date range but an exception falls inside it, the master is still needed for the merge step.
   Verify that `parseICalEvents` (which processes the full iCal string before date filtering)
   always has access to the master VEVENT.
