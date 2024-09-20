import { TemplateEngine } from '../src/contacts/TemplateEngine';
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

    const result = templateEngine.substitute(template, data);
    expect(result).toBe('Name: John Doe\nCity: New York');
  });

  test('Test array substitution', () => {
    const template = 'Friends:\n${friends[].name}';
    const data = {
      friends: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
    };
    const result = templateEngine.substitute(template, data);
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
    const result = templateEngine.substitute(template, data);
    console.log(result);
    expect(result).toBe('Friends:\nFriend: Alice (30)\nFriend: Bob (25)\nFriend: Charlie (35)');
  });

  test('Test missing fields substitution', () => {
    const template = 'Name: ${name}\nPhone: ${phone}';
    const data = {
      name: 'John Doe',
    };
    const result = templateEngine.substitute(template, data);
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
    const result = templateEngine.substitute(template, data);
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
    const result = templateEngine.substitute(template, data);
    expect(result).toBe(
      'First team: Alpha\nFirst member: Alice\nSecond team: Beta\nSecond member: David'
    );
  });

  test('Test single element array template substitution', () => {
    const template = 'Primary email: ${emails[0]`${value} (${tag??Unknown})`}';
    const data = {
      emails: [{ value: 'john.doe@ibm.com', tag: 'work' }, { value: 'john.doe@personal.com' }],
    };
    const result = templateEngine.substitute(template, data);
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
    const result = templateEngine.substitute(markdownContactTemplateA, testVCardData);
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
    const result = templateEngine.substitute(markdownContactTemplateB, testVCardData);
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
