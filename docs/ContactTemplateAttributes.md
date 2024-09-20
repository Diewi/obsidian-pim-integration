# Contact Template Attributes

This document lists the commonly available attributes exposed to template files when rendering
contacts. It focuses on the shape produced by the `typed-vcard` parser and the backend
representation typically used by the plugin (Outlook → vCard 2.1). The goal is an easy-to-read
reference you can copy into your vault and use while authoring templates.

## Guidelines and examples

- Access single values directly: `${name.familyName}` or `${title[0].value}`.
- Pick the first email and render with a default: ``${emails[0]`${value} (${tag??Unknown})`}``.
- Render an array as a CSV: `${emails[].value}` → `john@x.com,doe@x.com`.
- Render an array with per-element template (newline separated):

  ```${emails[].`- ${value} (${tag??Unknown})`}```

- Build mailto/tel HTML links inline in templates:

  ```${emails[0].`<a href="mailto:%22${name.familyName},%20${name.givenName}%22%20%3c${value}%3e">Mail</a>`}```

  ```${telephones[0].`<a href="tel:${value}">${tag??Phone}</a>`??No Phone}```

## Attribute availability by vCard version

The table below shows typical availability of common attributes across vCard versions. Use `✓`
for widely supported, `~` for partial/conditional support (present but not always populated or
componentized), and `-` for generally not used in that version. Availability may still vary by
exporter or backend implementation.

| Attribute (logical) | vCard 2.1 | vCard 3.0 | vCard 4.0 | Notes |
|---|:---:|:---:|:---:|---|
| `name.familyName`, `name.givenName` (N) | ✓ | ✓ | ✓ | Core name components |
| `name.formatted` (FN) | ✓ | ✓ | ✓ | Formatted full name |
| `emails[]` (EMAIL) | ✓ | ✓ | ✓ | Email addresses; later versions allow more params (TYPE, PREF) |
| `telephones[]` (TEL) | ✓ | ✓ | ✓ | Phone numbers with TYPE in 3.0/4.0 |
| `organization[]` (ORG) | ✓ | ✓ | ✓ | 2.1 often a single string; 3.0/4.0 allow units/components |
| `title[]` (TITLE) | ✓ | ✓ | ✓ | Role/position text |
| `addresses[]` (ADR) | ✓ | ✓ | ✓ | ADR exists in all; structured components more reliable in 3.0/4.0 |
| `addresses` components (street, city, region, postalCode, country) | ~ | ✓ | ✓ | Components may be flattened in 2.1 exports |
| `photo` / `logo` (PHOTO) | ✓ | ✓ | ✓ | Binary or URI-based photos; params differ across versions |
| `uid` (UID) | ~ | ✓ | ✓ | UID optional in 2.1 exports but common in later versions |
| `url[]` (URL) | ~ | ✓ | ✓ | URL field more common in 3.0/4.0 |
| `note` (NOTE) | ✓ | ✓ | ✓ | Free-text note |
| `birthday` (BDAY) | ~ | ✓ | ✓ | Format handling improved in later versions |
| `categories[]` (CATEGORIES) | ~ | ✓ | ✓ | Tagging / categories better-supported in 3.0/4.0 |
| `geo` (GEO) | ~ | ✓ | ✓ | Geographic coordinates supported in later versions |
| `key` (KEY) | ~ | ✓ | ✓ | Public key entries; limited in 2.1 exports |
| `sound` (SOUND) | ~ | ✓ | ✓ | Pronunciation/sound data; rarely used in 2.1 |
| `revision` (REV) | ~ | ✓ | ✓ | Revision timestamp more consistently present in 3.0/4.0 |
| `impp` / messaging (IMPP) | - | ✓ | ✓ | IMPP is introduced/standardized in 3.0+ |
| `version` (vCard version string) | ✓ | ✓ | ✓ | Present to indicate the source vCard version |

**Notes**
- `~` indicates the field exists in the vCard specification but may be omitted, flattened, or
  presented as a simple value when exported by older/back-end implementations (notably vCard 2.1
  exporters such as some Outlook versions).
- Design templates conservatively for Outlook (vCard 2.1): prefer top-level strings and array
  index forms with `??` fallbacks rather than assuming structured components are present.

## vCard version and backend considerations

Outlook binding (data-level)

- Microsoft Outlook traditionally exposes contact data compatible with vCard **2.1** semantics when
  exporting or bridging contacts. The plugin's Outlook backend therefore tends to operate on the
  vCard 2.1 shape. This means:
  - Prefer the simple, widely-supported attributes (`N`, `FN`, `TEL`, `EMAIL`, `ORG`, `ADR`, `TITLE`, `NOTE`, `BDAY`).
  - Use array-safe templates (e.g. `emails[0].value`, `telephones[].value`) and provide `??` defaults
    when a field may be missing.
  - When importing from Outlook, some richer components (detailed ADR components, parameterized
    TYPE values, extended properties) may be absent or normalized differently; rely on `typed-vcard`
    to normalize where possible.

## Table of attributes

The table below lists the common template attribute paths, their TypeScript shape (logical type),
the typical vCard field(s) they map to, a short description and a practical example. This is a
developer-focused reference intended to make template authoring quick and predictable.

| Attribute Path | Type | vCard field(s) | Description | Example |
|---|---:|---|---|---|
| `addresses[]` | array of `address` | ADR | Address entries; may include both formatted `fullAddress` and components | `[{fullAddress:"Cresent moon drive,...", locality:"New York"}]` |
| `addresses[].fullAddress` | string | ADR (formatted) | Full formatted address string when provided | `Cresent moon drive, Albaney, New York, 12345, USA` |
| `addresses[].street`, `addresses[].locality`, `addresses[].region`, `addresses[].postalCode`, `addresses[].country` | string | ADR components | Street / city / region / postal code / country components | `locality: New York` |
| `addresses[].tag` | string | TYPE | Address tag/label (work/home) | `work` |
| `birthday` | string / Date | BDAY | Birthday value (formats vary) | `1970-01-01` |
| `categories[]` | array of string | CATEGORIES | Tags / categories | `['friend','colleague']` |
| `emails[]` | array of `eMail` | EMAIL | Array of email entries (`value`, optional params/tags) | `[{value:"john@x.com",tag:"work"}]` |
| `emails[].addressType` | `MailType` | EMAIL params | Email address type hint (internet/x400) | `internet` |
| `emails[].tag` | string | TYPE / label | Label such as `work` / `home` | `work` |
| `emails[].value` | string | EMAIL | Raw email address | `john@x.com` |
| `gender` | `gender` | GENDER | Gender property with optional `sex` and `indentity` fields | `{sex:'M', indentity:'male'}` |
| `geo` | array of `GeoCoordinates` | GEO | Geographic coordinates (lat/lon) | `{latitude:..., longitude:...}` |
| `geo.latitude` | number | GEO | Latitude coordinate for `geo` entries | `52.5200` |
| `geo.longitude` | number | GEO | Longitude coordinate for `geo` entries | `13.4050` |
| `impp[]` | array of `impp` | IMPP | Messaging / IM protocol URIs (URI value-type) | `[{value:'sip:alice@example.com'}]` |
| `key` | `key` | KEY | Public key entries or key URIs | `key object` |
| `key.keyUri` | `valueUri` | KEY | URI pointing to a public key or key material | `{uri:'https://example.com/key.pub'}` |
| `logo` | `photo` | LOGO / PHOTO | Logo entry (occasionally used) | `photo object` |
| `name` | object (`name` type) | N | Structured name object with components | `{ familyName, givenName, ... }` |
| `name.formatted` / `formattedName` | string | FN | Formatted full name | `Doe, John` |
| `name.familyName` | string | N (family) | Family / last name component | `Doe` |
| `name.givenName` | string | N (given) | Given / first name component | `John` |
| `note` | string | NOTE | Free-text notes | `Met at conference` |
| `organization[]` | array of `organization` | ORG | Organization entries; may include `organizationName` and unit list | `{organizationName:"IBM", organizationUnit:["Accounting"]}` |
| `organization[].organizationName` | string | ORG | Company / organization name | `IBM` |
| `photo[]` | array of `photo` | PHOTO | Photo or logo entries (binary or URI + mediaType) | `[{value:"...base64...", mediaType:{type:'image',subType:'jpeg'}}]` |
| `photo[].encoding` | string | PHOTO | Optional encoding information for embedded binary photos | `b` |
| `photo[].mediaType` | `MediaType` | PHOTO | Media type structure for photo/logo entries | `{type:'image', subType:'jpeg'}` |
| `related[]` | array of `related` | RELATED | Related people entries (type + uri/text) | `[{relatedType:'friend', relatedText:'Jane'}]` |
| `revision` | Date / string | REV | Revision timestamp | `2023-01-01T12:00:00Z` |
| `role` | string | ROLE | Role / function string | `Manager` |
| `sound` | `vCardProperty` | SOUND | Pronunciation/sound entries | `sound object` |
| `source` | URL | SOURCE | Source URI for the vCard | `https://example.com/vcard.vcf` |
| `telephones[]` | array of `telepone` | TEL | Phone number entries (may include `valueUri`, `device`, `capabilities`) | `[{value:"(905) 555-1234",tag:"work"}]` |
| `telephones[].capabilities` | `phoneCapabilities[]` | TEL | Capabilities flags (voice/video/text) | `['voice']` |
| `telephones[].device` | `phoneDevice` | TEL | Device hint (tel/cell/fax/pager/textphone) | `cell` |
| `telephones[].tag` | string | TYPE / label | Label such as `work` / `home` | `home` |
| `telephones[].value` | string | TEL | Phone number string or URI | `(905) 555-1234` |
| `telephones[].valueUri` | `valueUri` | TEL | Structured URI for telephone values (if present) | `{uri:'tel:+15551234'}` |
| `timeZone` | string | TZ | Time zone identifier | `Europe/London` |
| `title[]` | array | TITLE | Job title / role entries | `[{value:"Money Counter"}]` |
| `uid` | string | UID | Contact unique id (if present) | `1234-...` |
| `url[]` | array of `url` | URL | Homepage / web links | `[{value:"https://example.com"}]` |
| `vCardProperty` | type | base property | Base property shape common to most vCard fields (params, type, value) | `{params:{}, value:'x'}` |
| `version` | string | VERSION | vCard version string (e.g. `2.1`, `3.0`, `4.0`) | `2.1` |
| `*.params` | object | property params | Raw parameter map for a property (key → string or string[]) | `{TYPE: ['work'], PREF: '1'}` |
| `*.type` | string[] | TYPE param | Parameter types (e.g. `work`, `home`) | `['work']` |
| `*.tag` | string | TYPE / label | Simple normalized tag such as `work` / `home` (convenience field) | `work` |
| `*.preferenceIdx` | number | PREF / preference index | Numeric preference ordering for multi-valued properties | `0` |
| `*.valueType` | `ValueType` | Value type hint | Indicates the property's value type (text, uri, date, etc.) | `date-time` |
| `*.value` | string / string[] | value | The raw value(s) of the property (string or component array) | `['John','Doe']` |

**Notes**
- The `typed-vcard` library provides slightly different shapes depending on vCard version (2.1, 3.0, 4.0). This reference uses the logical attribute names used by the plugin's template engine.
- Arrays are common (emails, telephones, addresses, organization and title entries). Use `[]` or indexed forms to select or render elements.
- Template engine features: array templates (``${arr[].`template`}``), single-element templates (``${arr[0]`...`}`` or ``${arr[0].`...`??Default}``), and defaults with `??`.

## Practical guidance

- If your template relies on ADR components (e.g. `addresses[].city`) assume those may be present in
  vCard 3.0/4.0 but not always in 2.1; provide a fallback like `${addresses[0].city??${addresses[0].value}}`.
- When using Outlook as the source, design templates around the conservative, widely-supported
  attributes and prefer the array/index forms with defaults.
- `typed-vcard` does normalization between versions; however, offsets and parameter semantics can
  change — test templates with sample vCards from each backend you plan to support.

Quick recipe (common templates)

- Frontmatter minimal contact:

  ```md
  ---
  fullname: ${name.formatted}
  email: ${emails[0]`${value} (${tag??Unknown})`}
  phone: ${telephones[0].`<a href="tel:${value}">${tag??Phone}</a>`??No Phone}
  organization: ${organization[0].`${value}`}
  title: ${title[0].value}
  addresses: ${addresses[].`${tag}: ${value}`}
  ---
  ```

- Body list of emails:

  ```md
  - 📧 Emails:
  ${emails[].`  - ${value} (${tag??Unknown})`}
  ```

---

_Last updated: Generated by assistant for repository documentation._
