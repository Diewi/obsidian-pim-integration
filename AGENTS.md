# Agent.md — obsidian-pim-integration

Distilled working knowledge for coding agents and new contributors. Read this before touching
the code. Keep it updated when behaviour described here changes. The user-facing docs are in
`README.md`; this file covers how the code is put together and the traps.

## What this repository is

A desktop-only Obsidian plugin (`manifest.json` id `obsidian-pim-integration`) that imports
**contacts** and **calendar events** from Microsoft Outlook into Markdown notes rendered from
user templates. Windows only in practice: Outlook is reached through COM interop from a small
.NET 8 console tool (`OutlookComBridge.exe`) that the plugin spawns. vCard parsing comes from the
sibling repo `../typed-vcard` (see its own `Agent.md`).

Status: early development, unreleased. No CI runs (`release.yml` sits at the repo root, not
under `.github/workflows/`, and references `main.js` / `styles.css` that the build no longer
produces at the root).

## Layout

```
src/main.ts                     Plugin entry: 4 commands, settings tab, applySettings()
src/settings.ts                 PimIntegrationSettings + DEFAULT_SETTINGS + settings manager
src/banner.js                   Prepended to the bundle by esbuild: patches path.resolve for edge-js
src/gui/                        Obsidian UI: settingsController, modals (contacts), calendarModals,
                                datePickerModal, inputValidator, suggesters (from Periodic Notes)
src/contacts/                   ContactImporterBase (abstract pipeline) + Markdown subclass
src/calendar/                   CalendarEvent type, CalendarEventParser (ical.js), CalendarImporterBase,
                                Markdown subclass, IVaultEventScanner + ObsidianVaultEventScanner
src/templateEngine/             TemplateEngine: ${...} substitution used by both importers
src/pimbackend/                 BackendManager, backend/variant interfaces, NativeExecutorCli / Edge
src/pimbackend/outlook/         Outlook backend type, variants, executors, deps.json generator
src/utils/                      fileUtils (sanitizeFilename), obsidianUtils, typeScriptUtils
src_native/proto/native_bridge.proto   Single source of truth for the TS <-> C# protocol
src_native/outlookcombridge/    C# CLI: CliEntryPoint, Commands/, OutlookContactBridge,
                                OutlookCalendarBridge, TestData, OutlookComBridge.Tests (xUnit)
src_generated/                  protobufjs output (gitignored; regenerate with npm run proto:generate)
dist_outlookcombridge/          dotnet build output; only 3 DLLs + deps/runtimeconfig json are committed
dist/                           esbuild output + copied assets; this is what gets deployed to a vault
docs/                           ContactTemplateAttributes.md + templates/ContactTemplate.md (shipped in dist/docs)
tests/                          Jest; fixtures, mocks, templates, diagnostic scripts
review.md                       Review brief for the calendar feature (partly stale, see below)
```

## Runtime architecture

```
Obsidian command (main.ts)
  -> PimIntegrationImportContacts / PimIntegrationImportCalendar (src/gui)
       reads template file from vault, builds the *Markdown importer
  -> ContactImporterBase / CalendarImporterBase.transform...()
       -> IContactImporterBackend / ICalendarImporterBackend (created by BackendTypeOutlook)
            -> IBackendOutlookNativeExecutor  (OutlookNativeExecutorFactory: 'cli' | 'edge')
                 -> NativeExecutorCli spawns OutlookComBridge.exe <command> [--json] [--test-data]
                      stdin : CliRequest protobuf (or JSON with --json)
                      stdout: 4-byte little-endian length + CliResponse protobuf (or JSON)
                 -> C# CommandRegistry -> ExportContactsCommand / ExportCalendarCommand
                      -> OutlookContactBridge / OutlookCalendarBridge (COM interop)
       <- raw vCard text (contacts) or iCalendar text (calendar)
  -> parse, filter, TemplateEngine.substitute, resolve file path, vault.adapter.write
```

Key facts:

- **Backend / variant model.** `BackendManager` knows one backend type (`Outlook`). A backend
  type has variants (`Outlook 15+`, `Custom Outlook Settings`) that only differ in assembly
  descriptors used for deps.json generation. `onSelectBackendType(variant, skipGeneration)`
  regenerates `OutlookComBridge.deps.json` / `.runtimeconfig.json` in the plugin's
  `outlookcombridge/` folder from the `templates/` copies. It is skipped on plugin load and only
  runs when the user changes the variant in settings. This machinery exists for edge mode and
  is not needed by the CLI path.
- **CLI vs edge.** `NativeExecutionMode` is `'cli' | 'edge'`. `OutlookNativeExecutorFactory
  .detectBestMode()` hard-codes `'cli'` because electron-edge-js needs native threads that the
  Obsidian renderer does not provide. Edge code (`NativeExecutorEdge`,
  `BackendOutlookNativeExecutorEdge`, `EdgeOutlookNativeExecutor` which is an unused duplicate,
  `banner.js`, `EdgeJsVersionReader`, `BackendOutlookDepsJsonGenerator`) is kept alive for a
  future switch; calendar export is not implemented on the edge path. The sibling checkouts
  `../edge`, `../edge-js`, `../electron-edge-js` and the `build/` folder are edge debugging
  material, not part of the plugin.
- **Protocol.** `native_bridge.proto` defines `CliRequest` (oneof `contact_export` |
  `calendar_export`), `CliResponse` (`success`, `error_message`, `export_result`,
  `simple_result`, ...), `ExportResult` (oneof `echo` | `vcards` | `merged_vcards` |
  `calendar`). Commands: `export-contacts`, `export-calendar`, `ping`, `test-echo`,
  `list-commands`; global flags `--json`, `--test-data`, `--validate-deps`, `--help`.
  `--test-data` makes every command return the fixtures in `TestData.cs` without touching
  Outlook, which is how the TS integration tests run on any Windows box.
- **Dates across the boundary.** TS converts `Date` to .NET ticks with `dateToTicks()` in
  `BackendOutlookNativeExecutorCLI.ts` (plain `number`, safe for roughly ±285 years around 1970;
  `protobufjs` falls back to `number` because `long` is not installed). C# reads them as
  `DateTimeKind.Utc`. Day boundaries are built in **local time** in `calendarModals.ts`
  (`new Date(y, m, d)` to `new Date(y, m, d + 1)`, exclusive end). `DatePickerModal` also parses
  its input as local midnight.
- **Contacts path.** C# walks the default Contacts folder and skips anything that is not a
  `ContactItem` (contact groups / `IPM.DistList` cannot be saved as vCard; the count goes to
  stderr). Export exceptions become `Success = false` plus a stderr line, because the TS
  executor only reads stderr on a non-zero exit. It calls `ContactItem.SaveAs(tmp, 6)` (vCard 2.1), re-reads the file
  detecting UTF-8 BOM / strict UTF-8 / Windows-1252, decodes QUOTED-PRINTABLE, strips the
  CHARSET/ENCODING params and normalizes to CRLF (`OutlookContactBridge.NormalizeVCard`). TS
  returns zero contacts for empty data, wraps `TypedVCardImpl` parse errors in `Err`, and iterates **only** `getVCardsV2_1()` (FIXME in
  `ContactImporterBase.ts`). File name is `formattedName` unless the contact folder setting
  ends with `.md` (then it is a path template).
- **Calendar path.** C# uses Outlook's `CalendarSharing.SaveAsICal` with
  `olFullDetails` and `IncludePrivateDetails`. Outlook returns whole recurring series
  (masters + exceptions), and exception VEVENTs come stripped of SUMMARY/ATTENDEE etc.
  `CalendarEventParser` (ical.js) flattens to `CalendarEvent` and `mergeRecurrenceExceptions`
  copies missing fields from the master with the same UID. `CalendarImporterBase
  .transformICalToTargetFormat` then: filters by `startDate` in range, drops
  `CLASS:PRIVATE|CONFIDENTIAL` unless `includePrivate`, drops all-day events unless disabled,
  resolves `previousEventLink` (vault scan for frontmatter `uid` + `meetingDate`), resolves
  `${carryForward}` (sections whose heading contains `%% carryForward %%` in the previous
  note), substitutes, resolves the file path, skips existing files unless `forceOverwrite`
  (the "Re-import" command), writes.
- **File paths.** Both importers support two modes for the folder setting: plain folder
  (auto filename `YYYY-MM-DD Summary.md` / `formattedName.md`) or a full path template ending
  in `.md` whose filename part must contain a `${...}` (validated live by `InputValidator` via
  `validateTemplatePath`). Illegal Windows filename chars `\ / : * ? " < > |` become `_`
  (`sanitizeFilename`); template values are sanitized before substitution so a `/` in a
  summary cannot create a directory. Resolved paths containing `//` are rejected.
- **Settings.** `PimIntegrationSettings` in `settings.ts`. `loadSettings()` always overwrites
  `selectedPimBackend` / `selectedPimBackendVariant` with fresh Outlook descriptors because
  class instances do not survive JSON round-trips; the settings UI matches dropdowns by name.
  Backend-specific values (`dotnetPath`, `outlookCalendarName`, `includePrivateCalendarEvents`)
  are pushed into the backend through duck-typed setters in `main.ts#applySettings`.

## Template engine syntax (src/templateEngine/TemplateEngine.ts)

Processed in this order, each via regex replace:

1. `${arr[].`inner template`|sep}` — render `inner` per element, join with `sep`
   (default newline, `\n` literal allowed). Empty renders are dropped.
2. `${arr[0].`inner`??default}` — single element; dot before the backtick is optional.
3. `${path??default}` — dotted path, `arr[0].x`, `arr[].x` (CSV, or `arr[].x|sep`), and
   `${dateProp|yyyy-MM-dd}` which formats a `Date` with `date-fns` `format` in **local time**.
   `null` counts as empty. A `default` is itself a template, substituted against the root
   data (so inside an array item you can still reference top-level fields).

Line endings are normalized to LF by default (`LineEnding.Unix`). The engine throws nothing;
`substitute()` returns `Result`. `tests/TemplateEngine.test.ts` is the executable spec.

## Build, deploy, test

| Task | Command | Notes |
|---|---|---|
| Install | `npm install` | Also links `typed-vCard` -> `../typed-vcard` (symlink in node_modules) |
| Regenerate TS protobuf | `npm run proto:generate` | Needs `protobufjs-cli`; writes `src_generated/` (gitignored, so run after a fresh clone) |
| Build C# bridge | `cd src_native/outlookcombridge && dotnet publish OutlookComBridge.csproj -c Release` | `dotnet build` only writes to `build/outlookcombridge/Release/`; only `publish` updates `dist_outlookcombridge/` (`PublishDir`), which `npm run build` copies into `dist/outlookcombridge/`. A clean first build can fail with missing `CliResponse`/`ExportResult` because protoc generates the file after sources are globbed; just run it again. Runs `protobuf_bin/bin/protoc.exe` first, which is gitignored: drop a protoc release into `protobuf_bin/` (see its `readme.txt`). README still says `src_outlookcombridge` and `dotnet publish`; the csproj is the truth |
| Build plugin | `npm run build` | `tsc -noEmit -skipLibCheck` then esbuild to `dist/` (minified in prod, inline sourcemap in `npm run dev` watch mode). Copies manifest, licenses, docs, `dist_outlookcombridge/*` into `dist/outlookcombridge/`, deps/runtimeconfig json into `dist/outlookcombridge/templates/`, and `electron-edge-js` lib/tools |
| Deploy | copy `dist/*` to `<vault>/.obsidian/plugins/obsidian-pim-integration/` | Manual; the "Build + deploy" VS Code task template has an empty command |
| TS tests | `npx jest` | `npm test` is watch mode. ~1 min |
| C# tests | `cd src_native/outlookcombridge && dotnet test OutlookComBridge.sln` | xUnit + Moq, no Outlook needed |
| Version bump | `npm version <x.y.z>` | runs `version-bump.mjs` to sync manifest.json / versions.json |

Test facts:

- `jest.config.js` sets `process.env.TZ = 'UTC'` so date formatting is deterministic, and maps
  `src_generated/native_bridge` to `tests/__mocks__/native_bridge.js` (which just re-requires
  the generated module, with a hand-written fallback).
- `tests/testUtils.ts` exports `describeWindows` / `testWindows`; integration tests use them.
- Integration tests (`*.integration.test.ts`, `BackendOutlookNativeExecutorCli*.test.ts`)
  need `dist_outlookcombridge/OutlookComBridge.exe`. They copy the folder into a temp dir,
  generate deps.json there with `BackendOutlookDepsJsonGenerator`, and run the real exe with
  `--test-data`. They skip themselves if the exe is missing.
- `tests/SmokeTestMarkdownContactImport.test.ts` talks to a **real Outlook** via
  `dist/outlookcombridge/OutlookComBridge.exe` and writes to `tests/test-output/`. It times out
  (15 s) when Outlook is slow or absent.
- `tests/edge/*` exercise electron-edge-js in a plain Node process and skip on CoreCLR init
  failure. `node tests/edge/test-edge-init.js` is the manual diagnostic from the README.
- Diagnostic scripts, not tests: `npx ts-node tests/dumpTodayCalendar.ts` (dump today's raw
  iCal + parsed JSON), `npx ts-node tests/generateCalendarSamples.ts` (render the sample
  calendar template to `tests/test-output/calendar/`).
- Unit tests subclass the abstract importers (`TestCalendarImporter`,
  `MockPimIntegrationContactImporterVCFMarkdown`) and capture `writeToFile` calls; they never
  need the Obsidian API. Keep new logic in the `*Base` classes so it stays testable this way.

State as of 2026-10-28 on this machine: `tsc` clean; 15 suites, 275 passed, 6 skipped,
2 failing:

- `SmokeTestMarkdownContactImport` — timeout against real Outlook (environmental).
- `BackendOutlookDepsJsonGenerator › should add EdgeJs entry to deps.json` — the test expects
  runtime key `EdgeJs.dll`, the generator now emits the Plugin-type relative path
  `bin/Release/EdgeJs.dll` (`addAssemblyEntry` uses `descriptor.filePath`). Test is stale
  relative to the code; the other 13 tests in that file pass.

## Conventions

- Prettier: 2 spaces, single quotes, semicolons, 100 columns, trailing commas es5. `.editorconfig`
  matches for ts/js/cs. ESLint 9 is installed but `.eslintrc` is legacy format.
- Return `Result<T, string>` from `oxide.ts` instead of throwing; use `match()` or
  `isErr()/unwrapErr()`. Promise-returning methods still resolve to a `Result`.
- User feedback goes through `ObsidianUtils.logAndNotice()` (console + `Notice`). Classes use a
  `private static readonly LOG_PREFIX = '[ClassName]'` for console output.
- Interfaces are prefixed `I` (`IBackendType`, `ICalendarImporterBackend`). Descriptor classes
  (`BackendTypeOutlookDescriptor`) are the serializable handles; `createInstance()` builds the
  real object.
- Import typed-vcard as `typed-vcard/src/<file>`; one file uses `typed-vCard/src/TypedVCardImpl`.
  Both resolve on Windows only because the filesystem is case-insensitive. Prefer the lower-case
  spelling and expect the package name mismatch (`typed-vCard` in `package.json`, `typed-vcard`
  in its own manifest) to bite on Linux.
- The Obsidian API is imported from `'obsidian'` in most files and from `'obsidian/obsidian'`
  in a few; both work with the bundled typings.
- Anything that touches `src_native/proto/native_bridge.proto` requires regenerating both sides
  (`npm run proto:generate` and `dotnet build`), updating `tests/__mocks__/native_bridge.js`'s
  fallback if new messages are used in tests, and keeping `TestData.cs` and
  `tests/fixtures/testCalendarData.ts` in sync (the TS tests assert against the C# fixtures).

## Known gaps and TODOs (from code comments and README)

- Only vCard 2.1 contacts are transformed; version-dependent dispatch is a FIXME.
- Only one backend (Outlook); CardDAV / CalDAV are planned. `IContactBackend` /
  `ICalendarBackend` are reached through `as unknown as` casts in the modals (FIXME).
- `ObsidianVaultEventScanner` does a linear scan of all markdown files under the calendar base
  dir on every recurring event; fine for small vaults.
- Folder-only mode can silently overwrite two same-day events with the same summary (they are
  now skipped unless force-overwrite, but the names still collide).
- `InputValidator` hint elements are inserted after `.setting-item` and are not explicitly
  removed on re-render.
- `BackendVariantOutlook15Plus.DOTNET_SHARED_FRAMEWORK_PATH` is a hard-coded 8.0.22 path that is
  no longer used; `BackendOutlookDepsJsonGenerator.detectSharedFrameworkPath` picks the newest
  `8.x` runtime under `dotnetPath`.
- `review.md` describes the calendar feature as reviewed before two later changes: the template
  engine formats in local time (not `UTCDate`), and `DatePickerModal` parses local midnight (not
  UTC). Trust the code and tests over `review.md` on those two points.
- README TODOs: ask Obsidian for native thread support (unblocks edge mode), publish the plugin
  once `typed-vcard` is on npm, re-evaluate direct C# compilation via edge.
