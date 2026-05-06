/**
 * Scans the vault for existing calendar event notes.
 * Used to find the most recent previous occurrence of a recurring event
 * so that the new note can link back to it via ${previousEventLink}.
 */
export interface IVaultEventScanner {
  /**
   * Find the most recent note for a recurring event series that was created
   * before the given date.
   *
   * @param uid - The iCal UID shared by all occurrences of the series.
   * @param beforeDate - YYYY-MM-DD date string; only notes with an earlier meetingDate qualify.
   * @param baseDir - Directory prefix to scope the search (e.g. "Calendar/"). Only files
   *                  whose path starts with this prefix are considered.
   * @returns The note's vault-relative path (without .md extension) if found, or null if no
   *          previous occurrence exists. The full path is needed for unambiguous wikilinks
   *          when multiple notes share the same basename.
   */
  findPreviousOccurrenceNote(uid: string, beforeDate: string, baseDir: string): string | null;

  /**
   * Read the full markdown content of a note identified by its vault-relative path.
   *
   * @param notePath - The note's vault-relative path (without .md extension).
   * @param baseDir - Directory prefix to scope the search.
   * @returns The note's content, or null if the note cannot be found or read.
   */
  readNoteContent(notePath: string, baseDir: string): Promise<string | null>;
}
