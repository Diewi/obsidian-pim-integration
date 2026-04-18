/**
 * One-shot script to generate sample markdown files from the MarkdownCalendarTemplate.
 * Used for manual review of the template engine output — not part of the unit test suite.
 *
 * Usage:  npx ts-node tests/generateCalendarSamples.ts
 * Output: tests/test-output/calendar/
 */

import * as fs from 'fs';
import * as path from 'path';
import { CalendarImporterBase } from '../src/calendar/CalendarImporterBase';
import { TEST_ICALENDAR_WITH_ATTENDEES } from './fixtures/testCalendarData';

// Concrete subclass that writes to the filesystem
class FileCalendarImporter extends CalendarImporterBase {
  async writeToFile(mdContent: string, filePath: string): Promise<void> {
    const absPath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, mdContent, 'utf-8');
    console.log(`  Written: ${absPath}`);
  }
}

// ---- main ----
const templatePath = path.resolve(__dirname, 'MarkdownCalendarTemplate.md');
const outputDir = path.resolve(__dirname, 'test-output', 'calendar');

console.log('=== Calendar Sample Generator ===');
console.log(`Template : ${templatePath}`);
console.log(`Output   : ${outputDir}`);
console.log();

const template = fs.readFileSync(templatePath, 'utf-8');
const importer = new FileCalendarImporter(outputDir, template);

(async () => {
  const result = await importer.transformICalToTargetFormat(TEST_ICALENDAR_WITH_ATTENDEES);

  if (result.isOk()) {
    console.log(`\nDone: ${result.unwrap()}`);
  } else {
    console.error(`\nError: ${result.unwrapErr()}`);
    process.exit(1);
  }
})();
