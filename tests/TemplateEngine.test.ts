import { TemplateEngine } from '../src/templateEngine/TemplateEngine';
import * as fs from 'fs';
import * as path from 'path';
import { vCardTs2_1 } from 'typed-vcard/src/vCardTs2_1';
import { TypedVCardImpl } from 'typed-vcard/src/TypedVCardImpl';

describe('Test template engine', () => {
  const templateEngine = new TemplateEngine();

  test('Test simple substitution', () => {
    const template = 'Name: ${name}\nCity: ${address.city}';
    const data = {
      name: 'John Doe',
      address: { city: 'New York' },
    };

    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Name: John Doe\nCity: New York');
  });

  test('Test array substitution', () => {
    const template = 'Friends:\n${friends[].name}';
    const data = {
      friends: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Friends:\nAlice,Bob,Charlie');
  });
  test('Test array with template substitution', () => {
    const data = {
      friends: [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 35 },
      ],
    };
    const template = 'Friends:\n${friends[].\`Friend: ${name} (${age})\`}';
    const result = templateEngine.substitute(template, data).unwrap();
    console.log(result);
    expect(result).toBe('Friends:\nFriend: Alice (30)\nFriend: Bob (25)\nFriend: Charlie (35)');
  });

  test('Test missing fields substitution', () => {
    const template = 'Name: ${name}\nPhone: ${phone}';
    const data = {
      name: 'John Doe',
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Name: John Doe\nPhone: ');
  });

  test('Test nested array substitution', () => {
    // Use separator syntax for members[].name|\n
    const template = 'Teams:\n${teams[].`Team: ${teamName}\nMembers:\n${members[].name|\\n}`}';
    const data = {
      teams: [
        {
          teamName: 'Alpha',
          members: [{ name: 'Alice' }, { name: 'Bob' }],
        },
        {
          teamName: 'Beta',
          members: [{ name: 'Charlie' }, { name: 'David' }],
        },
      ],
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe(
      'Teams:\nTeam: Alpha\nMembers:\nAlice\nBob\nTeam: Beta\nMembers:\nCharlie\nDavid'
    );
  });

  test('Test access to individual nested array members', () => {
    const template =
      'First team: ${teams[0].teamName}\nFirst member: ${teams[0].members[0].name}\nSecond team: ${teams[1].teamName}\nSecond member: ${teams[1].members[1].name}';
    const data = {
      teams: [
        {
          teamName: 'Alpha',
          members: [{ name: 'Alice' }, { name: 'Bob' }],
        },
        {
          teamName: 'Beta',
          members: [{ name: 'Charlie' }, { name: 'David' }],
        },
      ],
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe(
      'First team: Alpha\nFirst member: Alice\nSecond team: Beta\nSecond member: David'
    );
  });

  test('Test single element array template substitution', () => {
    const template = 'Primary email: ${emails[0]`${value} (${tag??Unknown})`}';
    const data = {
      emails: [{ value: 'john.doe@ibm.com', tag: 'work' }, { value: 'john.doe@personal.com' }],
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Primary email: john.doe@ibm.com (work)');
  });
});

describe('Test template engine with markdown', () => {
  const templateEngine = new TemplateEngine();
  let markdownContactTemplateA: string;
  let markdownContactTemplateB: string;
  let testVCardData: vCardTs2_1;

  beforeAll(() => {
    const markdownTemplatePathA = path.resolve(__dirname, 'MarkdownContactTemplateA.md');
    markdownContactTemplateA = fs.readFileSync(markdownTemplatePathA, 'utf-8');

    const markdownTemplatePathB = path.resolve(__dirname, 'MarkdownContactTemplateB.md');
    markdownContactTemplateB = fs.readFileSync(markdownTemplatePathB, 'utf-8');

    const vCardPath = path.resolve(__dirname, 'John_Doe_vCard_2_1.vcf');
    const vCardDataFile = fs.readFileSync(vCardPath, 'utf-8');
    const typedVCards = new TypedVCardImpl(vCardDataFile);
    testVCardData = typedVCards.getVCardsV2_1()[0];
  });

  test('Test contact substitution for markdown file - version A', () => {
    const result = templateEngine.substitute(markdownContactTemplateA, testVCardData).unwrap();
    expect(result).toBe(
      '---\n' +
        'fullname: Doe, John\n' +
        'emails:\n' +
        '  - john.doe@ibm.com (Unknown)\n' +
        'mailto:\n' +
        '  - <a href="mailto:%22Doe,%20John%22%20%3cjohn.doe@ibm.com%3e">Mailto</a>\n' +
        'phone:\n' +
        '  - <a href="tel:(905) 555-1234">work</a>\n' +
        '  - <a href="tel:(905) 666-1234">home</a>\n' +
        'organization:\n' +
        '  - IBM;Accounting\n' +
        'title: Money Counter\n' +
        'addresses:\n' +
        '  - work: Cresent moon drive,Albaney,New York,12345,United States of America\n' +
        '  - home: Silicon Alley 5,New York,New York,12345,United States of America\n' +
        '---\n' +
        '## 👤 Doe, John\n' +
        '- 📧 Emails:\n' +
        '	- <a href="mailto:%22Doe,%20John%22%20%3cjohn.doe@ibm.com%3e">Mail</a>\n' +
        '- ☎️ Phone:\n' +
        '	- <a href="tel:(905) 555-1234">work</a>\n' +
        '	- <a href="tel:(905) 666-1234">home</a>\n' +
        '- 🏢 Organization:\n' +
        '	- IBM;Accounting\n' +
        '- 📛 Title: Money Counter\n' +
        '- 🏠 Addresses:\n' +
        '	- work: Cresent moon drive,Albaney,New York,12345,United States of America\n' +
        '	- home: Silicon Alley 5,New York,New York,12345,United States of America\n'
    );
  });

  test('Test contact substitution for markdown file - version B', () => {
    const result = templateEngine.substitute(markdownContactTemplateB, testVCardData).unwrap();
    expect(result).toBe(
      '---\n' +
        'fullname: Doe, John\n' +
        'email: john.doe@ibm.com (Unknown)\n' +
        'mailto: <a href="mailto:%22Doe,%20John%22%20%3cjohn.doe@ibm.com%3e">Mailto</a>\n' +
        'phone: <a href="tel:(905) 555-1234">work</a>\n' +
        'organization: IBM;Accounting\n' +
        'title: Money Counter\n' +
        'addresses: work: Cresent moon drive,Albaney,New York,12345,United States of America\n' +
        '---\n' +
        '## 👤 Doe, John\n' +
        '- 📧 Emails:\n' +
        '	- <a href="mailto:%22Doe,%20John%22%20%3cjohn.doe@ibm.com%3e">Mail</a>\n' +
        '- ☎️ Phone:\n' +
        '	- <a href="tel:(905) 555-1234">work</a>\n' +
        '	- <a href="tel:(905) 666-1234">home</a>\n' +
        '- 🏢 Organization:\n' +
        '	- IBM;Accounting\n' +
        '- 📛 Title: Money Counter\n' +
        '- 🏠 Addresses:\n' +
        '	- work: Cresent moon drive,Albaney,New York,12345,United States of America\n' +
        '	- home: Silicon Alley 5,New York,New York,12345,United States of America\n'
    );
  });
});

describe('Test template engine with special characters', () => {
  const templateEngine = new TemplateEngine();

  test('Test simple substitution with umlauts and accents', () => {
    const template = 'Name: ${familyName}, ${givenName}\nTitle: ${title}';
    const data = {
      familyName: 'Müller-Lüdenscheidt',
      givenName: 'François José',
      title: 'Geschäftsführer',
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Name: Müller-Lüdenscheidt, François José\nTitle: Geschäftsführer');
  });

  test('Test nested property substitution with special characters', () => {
    const template = 'Contact: ${name.familyName}, ${name.givenName}\nCity: ${address.city}';
    const data = {
      name: { familyName: 'Ångström', givenName: 'Bjørn' },
      address: { city: 'København' },
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Contact: Ångström, Bjørn\nCity: København');
  });

  test('Test array substitution with CJK and Cyrillic names', () => {
    const template = 'Contacts:\n${contacts[].name}';
    const data = {
      contacts: [
        { name: '田中太郎' },
        { name: '王小明' },
        { name: 'Иванов Пётр' },
        { name: 'Müller' },
      ],
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Contacts:\n田中太郎,王小明,Иванов Пётр,Müller');
  });

  test('Test array template substitution with special characters', () => {
    const template = 'Team:\n${members[].`- ${name} (${role})`}';
    const data = {
      members: [
        { name: 'François Müller', role: 'Geschäftsführer' },
        { name: 'Bjørn Ångström', role: 'Développeur' },
        { name: '佐藤花子', role: 'エンジニア' },
      ],
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe(
      'Team:\n- François Müller (Geschäftsführer)\n- Bjørn Ångström (Développeur)\n- 佐藤花子 (エンジニア)'
    );
  });

  test('Test default value with special characters', () => {
    const template = 'Org: ${organization??Keine Angabe}\nNote: ${note??Keine Notiz verfügbar}';
    const data = {} as Record<string, unknown>;
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Org: Keine Angabe\nNote: Keine Notiz verfügbar');
  });

  test('Test single element array template with special characters', () => {
    const template = 'Primary: ${emails[0]`${value} (${tag??Unbekannt})`}';
    const data = {
      emails: [
        { value: 'françois@müller.example.com', tag: 'Arbeit' },
        { value: 'bjørn@ångström.example.com' },
      ],
    };
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Primary: françois@müller.example.com (Arbeit)');
  });

  test('Test special characters in address fields via parsed vCard', () => {
    const vCardString = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N:Müller-Lüdenscheidt;François;José;Dr.;',
      'FN:Dr. François José Müller-Lüdenscheidt',
      'ORG:Ångström & Associés GmbH',
      'TITLE:Geschäftsführer',
      'TEL;WORK;VOICE:+49-30-123456',
      'EMAIL;PREF;INTERNET:francois@angstroem-associes.example.com',
      'ADR;WORK:;;Königstraße 42;München;Bayern;80331;Deutschland',
      'NOTE:Spëcîal chars: äöüß éèêë ñ ø å æ 日本語 中文 кириллица',
      'END:VCARD',
    ].join('\r\n');

    const typedVCards = new TypedVCardImpl(vCardString);
    const vCard = typedVCards.getVCardsV2_1()[0];

    // Test name fields
    const nameTemplate = '${name.familyName}, ${name.givenName}';
    const nameResult = templateEngine.substitute(nameTemplate, vCard).unwrap();
    expect(nameResult).toBe('Müller-Lüdenscheidt, François');

    // Test organization
    const orgTemplate = '${organization[].value}';
    const orgResult = templateEngine.substitute(orgTemplate, vCard).unwrap();
    expect(orgResult).toContain('Ångström & Associés GmbH');

    // Test title
    const titleTemplate = '${title[].value}';
    const titleResult = templateEngine.substitute(titleTemplate, vCard).unwrap();
    expect(titleResult).toBe('Geschäftsführer');

    // Test address with Königstraße and München
    const addrTemplate = '${addresses[].`${tag}: ${value}`}';
    const addrResult = templateEngine.substitute(addrTemplate, vCard).unwrap();
    expect(addrResult).toContain('Königstraße 42');
    expect(addrResult).toContain('München');
    expect(addrResult).toContain('Deutschland');
  });

  test('Test markdown template with special character vCard', () => {
    const vCardString = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N:Müller;François;;;',
      'FN:François Müller',
      'ORG:Ångström GmbH',
      'TITLE:Développeur',
      'TEL;WORK;VOICE:+49-30-123456',
      'EMAIL;PREF;INTERNET:françois@müller.example.com',
      'ADR;WORK:;;Königstraße 42;München;Bayern;80331;Deutschland',
      'END:VCARD',
    ].join('\r\n');

    const typedVCards = new TypedVCardImpl(vCardString);
    const vCard = typedVCards.getVCardsV2_1()[0];

    const template =
      '## 👤 ${name.familyName}, ${name.givenName}\n' +
      '- 🏢 ${organization[].value}\n' +
      '- 📛 ${title[].value}\n' +
      '- 📧 ${emails[].value}\n' +
      '- 🏠 ${addresses[].`${tag}: ${value}`}';

    const result = templateEngine.substitute(template, vCard).unwrap();
    expect(result).toContain('Müller, François');
    expect(result).toContain('Ångström GmbH');
    expect(result).toContain('Développeur');
    expect(result).toContain('françois@müller.example.com');
    expect(result).toContain('Königstraße 42');
    expect(result).toContain('München');
  });
});

describe('TemplateEngine date pipe transforms', () => {
  const templateEngine = new TemplateEngine();
  // 2026-04-13 09:30 UTC (Monday)
  const testDate = new Date('2026-04-13T09:30:00.000Z');

  test('formats Date with yyyy for 4-digit year', () => {
    const result = templateEngine.substitute('${dt|yyyy}', { dt: testDate }).unwrap();
    expect(result).toBe('2026');
  });

  test('formats Date with MM for 2-digit month', () => {
    const result = templateEngine.substitute('${dt|MM}', { dt: testDate }).unwrap();
    expect(result).toBe('04');
  });

  test('formats Date with dd for 2-digit day', () => {
    const result = templateEngine.substitute('${dt|dd}', { dt: testDate }).unwrap();
    expect(result).toBe('13');
  });

  test('formats Date with HH:mm for time', () => {
    const result = templateEngine.substitute('${dt|HH:mm}', { dt: testDate }).unwrap();
    expect(result).toBe('09:30');
  });

  test('formats Date with EEEE for full weekday name', () => {
    const result = templateEngine.substitute('${dt|EEEE}', { dt: testDate }).unwrap();
    expect(result).toBe('Monday');
  });

  test('formats Date with compound format string', () => {
    const result = templateEngine.substitute('${dt|yyyy-MM-dd HH:mm}', { dt: testDate }).unwrap();
    expect(result).toBe('2026-04-13 09:30');
  });

  test('formats Date with yyyy/MM for directory path', () => {
    const result = templateEngine.substitute('Calendar/${dt|yyyy}/${dt|MM}/', { dt: testDate }).unwrap();
    expect(result).toBe('Calendar/2026/04/');
  });

  test('does not apply pipe to non-Date values', () => {
    const result = templateEngine.substitute('${name|yyyy}', { name: 'Alice' }).unwrap();
    // Falls back to full path lookup including |yyyy which returns undefined → empty
    // Then tries pipe split: gets 'Alice' for 'name' but 'Alice' is not a Date → returns as-is
    expect(result).toBe('Alice');
  });

  test('handles null Date gracefully', () => {
    const result = templateEngine.substitute('${dt|yyyy}', { dt: null }).unwrap();
    expect(result).toBe('');
  });

  test('pipe transform works alongside regular properties', () => {
    const data = {
      summary: 'Team Standup',
      startDate: new Date('2026-04-13T09:30:00.000Z'),
    };
    const template = '${summary} on ${startDate|yyyy-MM-dd} (year: ${startDate|yyyy})';
    const result = templateEngine.substitute(template, data).unwrap();
    expect(result).toBe('Team Standup on 2026-04-13 (year: 2026)');
  });

  test('array separator syntax still works with pipe', () => {
    const data = {
      members: [{ name: 'Alice' }, { name: 'Bob' }],
    };
    const result = templateEngine.substitute('${members[].name|, }', data).unwrap();
    expect(result).toBe('Alice, Bob');
  });

  test('pipe transform with default value fallback', () => {
    const result = templateEngine.substitute('${dt|yyyy??unknown}', { dt: null }).unwrap();
    expect(result).toBe('unknown');
  });

  test('formats Date with QQQ for quarter', () => {
    const result = templateEngine.substitute('${dt|QQQ}', { dt: testDate }).unwrap();
    expect(result).toBe('Q2');
  });
});
