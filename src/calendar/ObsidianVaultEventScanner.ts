import { App } from 'obsidian/obsidian';
import { IVaultEventScanner } from './IVaultEventScanner';

/**
 * Scans the Obsidian vault for previous occurrence notes of a recurring event
 * using the metadataCache for fast frontmatter lookups (no file I/O).
 *
 * The search is scoped to the calendar base directory to avoid scanning
 * the entire vault.
 *
 * Requires that imported calendar notes include `uid: <iCal UID>` and
 * `meetingDate: <YYYY-MM-DD ...>` in their YAML frontmatter.
 */
export class ObsidianVaultEventScanner implements IVaultEventScanner {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  findPreviousOccurrenceNote(uid: string, beforeDate: string, baseDir: string): string | null {
    // NOTE: Linear scan — acceptable for typical vault sizes but may become slow
    // for vaults with thousands of calendar notes. If users report performance
    // issues, consider caching the UID→file mapping for the duration of a single
    // import batch or building an index.
    const files = this.app.vault.getMarkdownFiles()
      .filter((f) => !baseDir || f.path.startsWith(baseDir));
    let bestMatch: { basename: string; meetingDate: string } | null = null;

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (!fm || fm.uid !== uid) continue;

      const meetingDate = this.extractDate(fm.meetingDate);
      if (!meetingDate || meetingDate >= beforeDate) continue;

      if (!bestMatch || meetingDate > bestMatch.meetingDate) {
        bestMatch = { basename: file.basename, meetingDate };
      }
    }

    return bestMatch?.basename ?? null;
  }

  async readNoteContent(basename: string, baseDir: string): Promise<string | null> {
    const file = this.app.vault.getMarkdownFiles()
      .filter((f) => !baseDir || f.path.startsWith(baseDir))
      .find((f) => f.basename === basename);
    if (!file) return null;
    return this.app.vault.read(file);
  }

  /**
   * Extract the YYYY-MM-DD portion from a meetingDate frontmatter value.
   * Handles formats like "2026-04-10", "2026-04-10 09:00", or date objects.
   *
   * A simple regex is used instead of date-fns because the input comes from
   * YAML frontmatter which is always stored as a plain string in the format
   * we control (YYYY-MM-DD prefix). Parsing through date-fns would add
   * unnecessary overhead and timezone-conversion risk for a pure string
   * prefix extraction.
   */
  private extractDate(value: unknown): string | null {
    if (!value) return null;
    const str = String(value);
    const match = str.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
  }
}
