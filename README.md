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

### Planned

- Contact import from remote CalDav
- Meeting note creation (Outlook)
  - individual appointment export from Outlook (refs VBAs in Obisdian-For-Business)
  - Import all meetings for a day using a command + form in Obsidian
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
- Write to obsidian dev board to enable native threads in exlectron platform
- Publish obsidian plugin after typed-vcards are published to NPM
- Validate the use of direct code compilation via edge again now that all dependencies are known
  from the debs and runtime jsons.

## References

- [Obisdian-For-Business (Archived)](https://github.com/tallguyjenks/Obsidian-For-Business)

## Credits
