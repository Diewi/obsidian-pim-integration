import { PimIntegrationContactImporterBase } from '../src/contacts/ContactImporterBase';
import { vCardTs2_1, vCardTs3_0, vCardTs4_0 } from 'typed-vcard';
import { Ok, Err, Result } from 'oxide.ts';

/** Concrete subclass that captures writeToFile calls instead of writing to disk. */
class TestContactImporter extends PimIntegrationContactImporterBase {
  writtenFiles: { content: string; filePath: string }[] = [];
  existingFiles: Set<string> = new Set();

  constructor(pluginDir: string, contactDir: string, targetTemplate: string) {
    super(pluginDir, contactDir, targetTemplate);
  }

  getContactRefName(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string> {
    const formattedName = vCard.name?.formatted;
    if (!formattedName) {
      return Err('No formatted name found');
    }
    return Ok(formattedName);
  }

  async writeToFile(content: string, filePath: string): Promise<void> {
    this.writtenFiles.push({ content, filePath });
    this.existingFiles.add(filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    return this.existingFiles.has(filePath);
  }
}

describe('ContactImporterBase resolveFilePath', () => {
  // typed-vcard exposes FN as name.formatted (name exists whenever N or FN is present).
  const makeVCard = (formatted: string | undefined, props: Partial<vCardTs2_1> = {}): vCardTs2_1 =>
    ({
      name: formatted === undefined ? undefined : { params: {}, value: [], formatted },
      ...props,
    }) as vCardTs2_1;

  describe('folder-only mode (contactDir without .md extension)', () => {
    test('appends sanitized name.formatted with .md extension', () => {
      const importer = new TestContactImporter('', 'Resources/Contacts', '');
      const vCard = makeVCard('Alice Smith');

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Resources/Contacts/Alice Smith.md');
    });

    test('sanitizes illegal characters in name.formatted', () => {
      const importer = new TestContactImporter('', 'Contacts', '');
      const vCard = makeVCard('Dr. Smith: MD/PhD');

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/Dr. Smith_ MD_PhD.md');
    });

    test('returns Err when name.formatted is missing', () => {
      const importer = new TestContactImporter('', 'Contacts', '');
      const vCard = makeVCard(undefined);

      const result = importer.resolveFilePath(vCard);

      expect(result.isErr()).toBe(true);
    });
  });

  describe('full-path mode (contactDir ending with .md)', () => {
    test('resolves template with name.formatted', () => {
      const importer = new TestContactImporter('', 'Contacts/${name.formatted}.md', '');
      const vCard = makeVCard('Bob Builder');

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/Bob Builder.md');
    });

    test('resolves template with role (a list since typed-vcard returns repeatable properties as lists)', () => {
      const importer = new TestContactImporter('', 'Contacts/${name.formatted} (${role}).md', '');
      const vCard = makeVCard('Alice Smith', { role: ['Engineer'] });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/Alice Smith (Engineer).md');
    });

    test('sanitizes illegal characters in resolved filename', () => {
      const importer = new TestContactImporter('', 'Contacts/${name.formatted}.md', '');
      const vCard = makeVCard('Dr. Smith: MD');

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/Dr. Smith_ MD.md');
    });

    test('preserves directory separators in template', () => {
      const importer = new TestContactImporter('', 'Resources/Contacts/${name.formatted}.md', '');
      const vCard = makeVCard('John Doe');

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Resources/Contacts/John Doe.md');
    });

    test('handles slash in name.formatted without creating phantom directories', () => {
      const importer = new TestContactImporter('', 'Contacts/${name.formatted}.md', '');
      const vCard = makeVCard('Smith A/B');

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      // The slash in the name is in the last segment and gets sanitized
      expect(result.unwrap()).toBe('Contacts/Smith A_B.md');
    });

    test('sanitizes nested and list values used in a directory segment', () => {
      // Values substituted into a directory segment must not add directories either.
      const importer = new TestContactImporter(
        '',
        'Contacts/${organization[0].value}/${role[0]} - ${name.formatted}.md',
        ''
      );
      const vCard = makeVCard('Jane Roe', {
        role: ['QA/Test'],
        organization: [{ params: {}, value: 'R/D Corp', organizationName: 'R/D Corp' }],
      });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/R_D Corp/QA_Test - Jane Roe.md');
    });

    test('resolves empty placeholder to empty string', () => {
      const importer = new TestContactImporter('', 'Contacts/${name.formatted} - ${role}.md', '');
      const vCard = makeVCard('John Doe', { role: undefined });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/John Doe - .md');
    });
  });
});

describe('ContactImporterBase sanitizeVCardForPath', () => {
  test('keeps Date and URL values untouched', () => {
    const revision = new Date(2020, 0, 1);
    const source = [new URL('http://example.com/a/b.vcf')];
    const sanitized = PimIntegrationContactImporterBase.sanitizeVCardForPath({
      revision,
      source,
    } as vCardTs2_1);

    expect(sanitized.revision).toBe(revision);
    expect((sanitized.source as URL[])[0]).toBe(source[0]);
  });
});

describe('ContactImporterBase sanitizeFilePath', () => {
  test('sanitizes only the filename portion', () => {
    const result = PimIntegrationContactImporterBase.sanitizeFilePath('Dir/Sub/File: "test".md');
    expect(result).toBe('Dir/Sub/File_ _test_.md');
  });

  test('handles path without directory separators', () => {
    const result = PimIntegrationContactImporterBase.sanitizeFilePath('Name: Special.md');
    expect(result).toBe('Name_ Special.md');
  });

  test('leaves clean filenames unchanged', () => {
    const result = PimIntegrationContactImporterBase.sanitizeFilePath('Contacts/John Doe.md');
    expect(result).toBe('Contacts/John Doe.md');
  });
});

describe('ContactImporterBase transformContactsToTargetFormat with full-path mode', () => {
  const VCARD_DATA =
    'BEGIN:VCARD\r\n' +
    'VERSION:2.1\r\n' +
    'FN:Alice Test\r\n' +
    'N:Test;Alice;;;\r\n' +
    'END:VCARD\r\n' +
    'BEGIN:VCARD\r\n' +
    'VERSION:2.1\r\n' +
    'FN:Bob Example\r\n' +
    'N:Example;Bob;;;\r\n' +
    'END:VCARD\r\n';

  test('uses template path for file output', async () => {
    const importer = new TestContactImporter('', 'People/${name.formatted}.md', '# ${name.formatted}');

    const result = await importer.transformContactsToTargetFormat(VCARD_DATA);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(2);
    expect(importer.writtenFiles[0].filePath).toBe('People/Alice Test.md');
    expect(importer.writtenFiles[1].filePath).toBe('People/Bob Example.md');
    expect(importer.writtenFiles[0].content).toBe('# Alice Test');
  });

  test('fails instead of overwriting when a placeholder resolves to an empty file name', async () => {
    // formattedName no longer exists in typed-vcard (it is name.formatted); a stale template
    // must not write every contact to "People/.md".
    const importer = new TestContactImporter('', 'People/${formattedName}.md', '# ${name.formatted}');

    const result = await importer.transformContactsToTargetFormat(VCARD_DATA);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toContain('2 failed');
    expect(importer.writtenFiles).toHaveLength(0);
  });

  test('uses folder + name.formatted when contactDir has no .md extension', async () => {
    const importer = new TestContactImporter('', 'People', '# ${name.formatted}');

    const result = await importer.transformContactsToTargetFormat(VCARD_DATA);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(2);
    expect(importer.writtenFiles[0].filePath).toBe('People/Alice Test.md');
    expect(importer.writtenFiles[1].filePath).toBe('People/Bob Example.md');
  });
});

describe('ContactImporterBase transformContactsToTargetFormat with empty or invalid input', () => {
  test('treats empty vCard data as zero contacts', async () => {
    const importer = new TestContactImporter('', 'Contacts', '');

    const result = await importer.transformContactsToTargetFormat('');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe('0 contact(s) written, all verified on disk');
    expect(importer.writtenFiles).toHaveLength(0);
  });

  test('treats whitespace-only vCard data as zero contacts', async () => {
    const importer = new TestContactImporter('', 'Contacts', '');

    const result = await importer.transformContactsToTargetFormat('   ');

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(0);
  });

  test('returns an error instead of throwing on unparsable vCard data', async () => {
    const importer = new TestContactImporter('', 'Contacts', '');

    const result = await importer.transformContactsToTargetFormat('not a vcard');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toContain('Failed to parse vCard data');
    expect(importer.writtenFiles).toHaveLength(0);
  });
});
