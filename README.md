# Obsidian PIM Integration

**NOTE:** This plugin is under active early development. Concepts and UI may undergo large
changes.

This Obsidian plugin provides integration with MS Office and other PIM interfaces such as CardDav
and alike. It is intended as a bridge between typical personal information tools and the Obsidian
knowledge database and life management system. Contacts, Meetings etc. are typical artifacts that
are present in these two types of applications and often induces (manual) data duplication.

In order to relive us from tedious data copying and/or error prone data duplication, this plugin
is intended as a limited syncronization tool between the aforementioned applications. One example
is the import of contacts from the MS Outlook contact folder using the C# API from an Obsidian
command. The contacts are transformed into Markdown files at a specified location in your vault.

## Feature Overview

- Contact import from MS Outlook using the C# API and Interop Assemblies
- Calendar event import from Outlook — import all meetings for a given day into your vault as
  individual Markdown notes, complete with frontmatter, attendee lists, and automatic linking
  between recurring meetings

### Planned

- Contact import from remote CalDav
**TDB**

## Installation

**TBD**

## Howto

### Quick start
 - Install and enable the plugin in Obsidian (dev mode if testing locally).
 - Configure the backend in the plugin settings (e.g. Outlook bridge) before running imports.
 - Define the templates to use for imported data.
 - Define the output directories per data type (contacts, meeting notes, ...).

### Templates (overview)
 - The plugin uses Markdown template files to generate contact notes, meeting notes, etc.
 - A template contains plain text and template expressions (the plugin's template syntax).
 - Ship-in templates live in the plugin folder under `plugins\obsidian-pim-integration\docs\templates`.
 - You can provide your own templates by placing them in your vault and pointing the plugin settings
   at the template file path.

### How to create and use a template
 1. Create a Markdown file and add the content and placeholders where you want data inserted.
 2. In the plugin settings select the template file for the artifact type (contacts, meetings, ...).
 3. Run the import command from the plugin command palette — the plugin will render the template
    and write the generated Markdown file to the configured output folder in your vault.

### Template examples and tips
 - Use `${name.familyName}, ${name.givenName}` to print the formatted full name.
 - Use array expressions like `${emails[].value}` to join values with commas or use the
   array-template form `${emails[].`- ${value}`}` to render each element on a separate line.
 - Provide defaults with `??`, e.g. `${tag??Unknown}` to fall back when a field is missing.
 - For mailto/phone links you can build HTML in the template: `${emails[0].`<a href="mailto:${value}">Mail</a>`}`.

### Testing templates locally
 - You can test templates by running the plugin's preview or by importing a single contact and
   inspecting the generated Markdown in your vault.
 - Unit tests for the template engine live in `tests/TemplateEngine.test.ts` and demonstrate
   many of the supported patterns; consult them when creating new template constructs.

### Common pitfalls
 - Make sure the template path configured in settings is accessible by the plugin (use vault paths).
 - If fields appear empty, verify the source contact has the expected properties (use the
   template engine tests or console logging to inspect the parsed vCard object).


Want an example? Copy one of the files from `plugins\obsidian-pim-integration\obsidian-templates`
into your vault and point the plugin at it — it is the quickest way to get started.

### Template data reference (quick)

- Source: templates render against the parsed contact object produced by `typed-vcard`.
- Typical top-level attributes available in templates: `name`, `formattedName`/`fullName`, `emails`,
  `telephones`, `organization`, `title`, `addresses`, `uid`, `url`, `note`, `birthday`, `categories`.
- Arrays are common: use indexed forms (`emails[0].value`) or array templates (`${emails[].`- ${value}`}`).
- Default values: use the `??` operator, e.g. `${tag??Unknown}`.
- Outlook binding: when using the Outlook backend prefer the conservative vCard 2.1-compatible fields
  (N, FN, TEL, EMAIL, ORG, ADR, TITLE, NOTE, BDAY). Design templates with array/index forms and
  sensible fallbacks to handle missing components.

For a full attribute table, examples and per-vCard-version availability, see
`docs/ContactTemplateAttributes.md` in this repository.

### Calendar event import

The plugin can import all calendar events for a chosen day from Outlook and create one Markdown
note per event. Two commands are available in the Obsidian command palette:

| Command | What it does |
|---------|-------------|
| **Import Calendar — Today** | Imports every event from today's calendar. |
| **Import Calendar — Select Date** | Opens a date picker so you can choose any day. |

Each imported note is rendered from the *Calendar Event Template* you configure in the
plugin settings. A template is a normal Markdown file that contains placeholders which the
plugin fills in with data from the calendar event.

#### Plugin settings for calendar import

Open *Settings → Obsidian PIM Integration* and scroll to the **Calendar** section. You will
find three settings:

| Setting | Purpose |
|---------|---------|
| **Calendar Event Path** | Where the generated note files are stored (see details below). |
| **Calendar Event Template** | Path to the Markdown template file in your vault. |
| **Outlook Calendar Folder** | *(Optional)* Name of the Outlook calendar folder to read from. Leave empty to use your default calendar. |
| **Include Private Calendar Events** | When enabled, events marked as private or confidential in Outlook are also imported. Off by default — private/confidential events are silently skipped. |

#### Calendar Event Path — how to define where notes are saved

The *Calendar Event Path* tells the plugin where to save each event note. You have two options:

**Option A — Folder only**
Enter just a folder path. The plugin will auto-generate a filename from the event date and
title.

```
Resources/Calendar
```

Result: `Resources/Calendar/2025-06-15 Weekly Standup.md`

You can include placeholders in the folder path to organise notes into sub-folders
automatically:

```
Calendar/${startDate|yyyy}/${startDate|yyyy-MM-dd}
```

Result: `Calendar/2025/2025-06-15/2025-06-15 Weekly Standup.md`

**Option B — Full path with custom filename**
End the path with `.md` to take full control over the file name. In this mode the filename
**must contain at least one placeholder** so that each event gets its own file.

```
Calendar/${startDate|yyyy-MM-dd} ${summary}.md
```

Result: `Calendar/2025-06-15 Weekly Standup.md`

> **Validation:** The settings field checks your input as you type and shows an error hint
> if the path cannot be resolved (e.g. unknown placeholder, missing variable in the
> filename, or empty path segments).

> **Filename sanitization:** In full-path mode the plugin automatically replaces characters
> that are invalid on Windows (`\ : * ? " < > |`) with `_` so that event subjects containing
> colons or other special characters do not cause file-system errors.

#### Writing a calendar event template

A template is a Markdown file with placeholders written as `${propertyName}`. When an event
is imported, each placeholder is replaced with the matching value from that event.

**Available event properties:**

| Placeholder | Description | Example value |
|-------------|-------------|---------------|
| `${summary}` | Event title / subject | `Weekly Standup` |
| `${description}` | Event body text | *(multi-line text)* |
| `${location}` | Location string | `Room 4.01` |
| `${startDate\|format}` | Start date/time — **requires a format** (see below) | `2025-06-15 09:00` |
| `${endDate\|format}` | End date/time — **requires a format** | `2025-06-15 09:30` |
| `${durationMinutes}` | Duration in minutes | `30` |
| `${uid}` | Unique calendar ID | `abc123@outlook` |
| `${organizer}` | Organizer name or email | `Jane Doe` |
| `${status}` | Status (CONFIRMED / TENTATIVE / CANCELLED) | `CONFIRMED` |
| `${attendees}` | Comma-separated attendee names | `Jane Doe, John Smith` |
| `${attendeeList[].name}` | Array of attendee names (one per line in a template, see below) | |
| `${recurrenceRule}` | Recurrence rule (e.g. `FREQ=WEEKLY;BYDAY=MO`) | |
| `${classType}` | Visibility class (`PUBLIC`, `PRIVATE`, `CONFIDENTIAL`) | `PUBLIC` |
| `${previousEventLink}` | Wikilink to the previous occurrence note (recurring events only) | `[[2025-06-08 Weekly Standup]]` |

#### Date and time formatting

Dates must be formatted using a *pipe transform*. Write the property name, a vertical bar `|`,
then a format pattern. The format uses the [date-fns format tokens](https://date-fns.org/docs/format):

| Placeholder | Result |
|-------------|--------|
| `${startDate\|yyyy-MM-dd}` | `2025-06-15` |
| `${startDate\|HH:mm}` | `09:00` |
| `${startDate\|yyyy-MM-dd HH:mm}` | `2025-06-15 09:00` |
| `${startDate\|eeee}` | `Sunday` |
| `${startDate\|yyyy-MM-dd-eeee}` | `2025-06-15-Sunday` |

Common tokens: `yyyy` = year, `MM` = month (01–12), `dd` = day, `HH` = hour (00–23),
`mm` = minutes, `eeee` = weekday name.

#### Attendee list (array template)

To list every attendee on its own line, use the array-template syntax:

```
${attendeeList[].` - [ ] [[${name??Unknown}]]`}
```

This produces one line per attendee:
```
 - [ ] [[Jane Doe]]
 - [ ] [[John Smith]]
```

The `??Unknown` part is a fallback — if an attendee has no name, `Unknown` is printed instead.

#### Default values

Use `??` to provide a fallback when a field might be empty:

```
${location??No location specified}
```

#### Carry-forward for recurring meetings

When the same meeting repeats (e.g. a weekly standup), you often want to carry over certain
sections — like open action items — into the next occurrence's note.

**How it works:**

1. **In your template**, place `${carryForward}` where you want the carried-over content to
   appear (typically near the end).

2. **In an imported meeting note**, mark any heading whose content should carry forward by
   adding the Obsidian comment `%% carryForward %%` to the heading line. For example:

   ```markdown
   ### Next Actions %% carryForward %%
   - [ ] Finish the design review
   - [ ] Send follow-up email
   ```

3. When the *next* occurrence of that meeting is imported, the plugin finds the previous
   note (via the event UID), reads it, extracts every section whose heading contains the
   `%% carryForward %%` marker, and inserts that content where `${carryForward}` appears
   in the template.

4. The marker is preserved in the carried-over content, so the chain continues automatically
   for future occurrences — you do not need to re-add it each time.

> **Tip:** You can mark as many headings as you like. Each marked section (heading + all
> content until the next heading of the same or higher level) will be carried forward.

#### Linking to the previous occurrence

The placeholder `${previousEventLink}` is automatically filled with a wikilink to the most
recent earlier note that shares the same calendar UID. This only works for recurring events
and requires that your template includes `uid: ${uid}` and `meetingDate: ${startDate|yyyy-MM-dd ...}`
in the YAML frontmatter so the plugin can find previous notes.

#### Recurring event exceptions (moved/modified instances)

When Outlook exports a recurring event that has been moved or modified (e.g. a single
occurrence rescheduled to a different time), the iCal data may contain exception entries
with missing summary, organizer and attendees. The plugin automatically fills in these
missing fields from the recurring series master so that every imported note has the correct
title and participant information.

#### Example template

```markdown
---
tags: [Meetings]
meetingDate: ${startDate|yyyy-MM-dd HH:mm}
uid: ${uid}
parent: "[[${startDate|yyyy-MM-dd-eeee}]]"
previous: "${previousEventLink}"
project:
---
### **Next Actions**

### Participants %% fold %%
${attendeeList[].` - [ ] [[${name??Unknown}]]`}

### Agenda

### Notes

${carryForward}
```

## Build Instructions

### Overview

This section explains how to build the plugin (TypeScript + assets) and how to build/publish the
Outlook COM Bridge (native/.NET helper) used by the plugin. Follow the short instructions below
for a typical developer setup on Windows.

### Prerequisites

- Node.js (16+ or as specified in `package.json`)
- npm (or yarn/pnpm) installed and available on PATH
- .NET SDK (required to build the Outlook COM Bridge) — recommended version: .NET 8
- (Optional) VS Code with the included tasks for convenience

### Build plugin (TypeScript -> `dist`)

1. From the repository root run:

```bash
npm install
npm run build
```

2. Output

- Built plugin artifacts are emitted to the `dist` folder.
- The plugin expects the Outlook COM Bridge DLLs to be available under `dist_outlookcombridge`.

3. Useful VS Code tasks

- The workspace includes helpful tasks under `.vscode/tasks.json` (for example `npm: build`).
  Use the VS Code Task Runner to invoke them if you prefer an IDE workflow.

### Build & publish Outlook COM Bridge (src_outlookcombridge)

The Outlook bridge is a small .NET project located in `src_outlookcombridge`. It must be built
separately and its resulting DLLs copied to `dist_outlookcombridge` for the plugin to consume.

1. Build (Debug):

```powershell
cd src_outlookcombridge
dotnet build OutlookComBridge.sln
```

2. Publish (Release) — produces self-contained/publishable artifacts:

```powershell
cd src_outlookcombridge
dotnet publish OutlookComBridge.sln -c Release -o ../dist_outlookcombridge
```

3. Notes

- The plugin reads the DLLs from `dist_outlookcombridge`. Adjust the `-o` path when publishing
  if you want a different output folder.
- If you change the bridge API, remember to update the plugin's bindings or copy the newly
  published DLLs into the plugin `dist_outlookcombridge` before testing inside Obsidian.

### Deploy plugin files to Obsidian (manual)

After `npm run build` completes, copy the contents of `dist` into your Obsidian community plugin
folder for testing. On Windows the vault plugin folder is typically:

```
%APPDATA%\Obsidian\[YourVault]\plugins\obsidian-pim-integration
```

You can automate the copy step by adding a small script or using the provided VS Code task
(`Build + deploy plugin files`) that depends on the `npm: build` task.

### Running tests

Run the unit tests with:

```bash
npm test
```

### Troubleshooting

- If the plugin fails to find the Outlook bridge DLLs, ensure `dist_outlookcombridge` contains the
  published outputs from `dotnet publish`.
- If TypeScript build fails, check `tsconfig.json` and run `npm run build` to see compiler errors.
- If the Outlook bridge is not operational, launch the edge init test script from the main directory
  to generate some debugging output:`

  ```powershell
  node tests/edge/test-edge-init.js 2>&1 | Select-String -Pattern "(Error|edge.func exists|End of test|Failed|EdgeJs|Function loaded|Adding tpa.*EdgeJs)"
  ```


### Quick checklist for release

- Run `npm run build` and verify `dist` contains the plugin bundle.
- Publish or copy the `src_outlookcombridge` outputs to `dist_outlookcombridge`.
- Verify tests pass: `npm test`.
- Package or copy `dist` into the Obsidian plugin folder for testing.


## TODO
- Move setting reset command to settings as a button
- Write to obsidian dev board to enable native threads in exlectron platform
- Publish obsidian plugin after typed-vcards are published to NPM
- Validate the use of direct code compilation via edge again now that all dependencies are known
  from the debs and runtime jsons.

## References

- [Obisdian-For-Business (Archived)](https://github.com/tallguyjenks/Obsidian-For-Business)

## Credits
