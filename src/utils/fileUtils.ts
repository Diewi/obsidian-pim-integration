/**
 * Characters that are illegal in Windows file names.
 * Windows is the most restrictive common platform; sanitizing for Windows
 * ensures compatibility on Linux, macOS, Android and iOS as well.
 */
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;

/**
 * Replace characters that are illegal in Windows filenames with the given
 * replacement character (default `_`).
 *
 * @param name     The raw filename (without directory separators).
 * @param replacement  The character to substitute for illegal characters.
 */
export function sanitizeFilename(name: string, replacement: string = '_'): string {
  return name.replace(ILLEGAL_FILENAME_CHARS, replacement);
}
