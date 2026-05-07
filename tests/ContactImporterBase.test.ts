import { PimIntegrationContactImporterBase } from '../src/contacts/ContactImporterBase';
import { vCardTs2_1 } from 'typed-vcard/src/vCardTs2_1';
import { vCardTs3_0 } from 'typed-vcard/src/vCardTs3_0';
import { vCardTs4_0 } from 'typed-vcard/src/vCardTs4_0';
import { Ok, Err, Result } from 'oxide.ts';

/** Concrete subclass that captures writeToFile calls instead of writing to disk. */
class TestContactImporter extends PimIntegrationContactImporterBase {
  writtenFiles: { content: string; filePath: string }[] = [];
  existingFiles: Set<string> = new Set();

  constructor(pluginDir: string, contactDir: string, targetTemplate: string) {
    super(pluginDir, contactDir, targetTemplate);
  }

  getContactRefName(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string> {
    if (!vCard.formattedName) {
      return Err('No formatted name found');
    }
    return Ok(vCard.formattedName);
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
  const makeVCard = (props: Partial<vCardTs2_1>): vCardTs2_1 => ({
    formattedName: 'John Doe',
    ...props,
  } as vCardTs2_1);

  describe('folder-only mode (contactDir without .md extension)', () => {
    test('appends sanitized formattedName with .md extension', () => {
      const importer = new TestContactImporter('', 'Resources/Contacts', '');
      const vCard = makeVCard({ formattedName: 'Alice Smith' });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Resources/Contacts/Alice Smith.md');
    });

    test('sanitizes illegal characters in formattedName', () => {
      const importer = new TestContactImporter('', 'Contacts', '');
      const vCard = makeVCard({ formattedName: 'Dr. Smith: MD/PhD' });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/Dr. Smith_ MD_PhD.md');
    });

    test('returns Err when formattedName is missing', () => {
      const importer = new TestContactImporter('', 'Contacts', '');
      const vCard = makeVCard({ formattedName: undefined });

      const result = importer.resolveFilePath(vCard);

      expect(result.isErr()).toBe(true);
    });
  });

  describe('full-path mode (contactDir ending with .md)', () => {
    test('resolves template with formattedName', () => {
      const importer = new TestContactImporter('', 'Contacts/${formattedName}.md', '');
      const vCard = makeVCard({ formattedName: 'Bob Builder' });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/Bob Builder.md');
    });

    test('resolves template with organization', () => {
      const importer = new TestContactImporter('', 'Contacts/${formattedName} (${role}).md', '');
      const vCard = makeVCard({ formattedName: 'Alice Smith', role: 'Engineer' });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/Alice Smith (Engineer).md');
    });

    test('sanitizes illegal characters in resolved filename', () => {
      const importer = new TestContactImporter('', 'Contacts/${formattedName}.md', '');
      const vCard = makeVCard({ formattedName: 'Dr. Smith: MD' });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/Dr. Smith_ MD.md');
    });

    test('preserves directory separators in template', () => {
      const importer = new TestContactImporter('', 'Resources/Contacts/${formattedName}.md', '');
      const vCard = makeVCard({ formattedName: 'John Doe' });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Resources/Contacts/John Doe.md');
    });

    test('handles slash in formattedName without creating phantom directories', () => {
      const importer = new TestContactImporter('', 'Contacts/${formattedName}.md', '');
      const vCard = makeVCard({ formattedName: 'Smith A/B' });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      // The slash in the name is in the last segment and gets sanitized
      expect(result.unwrap()).toBe('Contacts/Smith A_B.md');
    });

    test('resolves empty placeholder to empty string', () => {
      const importer = new TestContactImporter('', 'Contacts/${formattedName} - ${role}.md', '');
      const vCard = makeVCard({ formattedName: 'John Doe', role: undefined });

      const result = importer.resolveFilePath(vCard);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('Contacts/John Doe - .md');
    });
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
    const importer = new TestContactImporter(
      '',
      'People/${formattedName}.md',
      '# ${formattedName}'
    );

    const result = await importer.transformContactsToTargetFormat(VCARD_DATA);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(2);
    expect(importer.writtenFiles[0].filePath).toBe('People/Alice Test.md');
    expect(importer.writtenFiles[1].filePath).toBe('People/Bob Example.md');
  });

  test('uses folder + formattedName when contactDir has no .md extension', async () => {
    const importer = new TestContactImporter(
      '',
      'People',
      '# ${formattedName}'
    );

    const result = await importer.transformContactsToTargetFormat(VCARD_DATA);

    expect(result.isOk()).toBe(true);
    expect(importer.writtenFiles).toHaveLength(2);
    expect(importer.writtenFiles[0].filePath).toBe('People/Alice Test.md');
    expect(importer.writtenFiles[1].filePath).toBe('People/Bob Example.md');
  });
});
