/**
 * Test utilities for platform-specific and conditional test execution.
 */

/**
 * Use this for Windows-only test suites.
 * On non-Windows platforms, the test suite will be skipped properly.
 *
 * @example
 * describeWindows('Outlook Integration Tests', () => {
 *     test('should work on Windows', () => {
 *         // ...
 *     });
 * });
 */
export const describeWindows = process.platform === 'win32' ? describe : describe.skip;

/**
 * Use this for Windows-only individual tests.
 * On non-Windows platforms, the test will be skipped properly.
 *
 * @example
 * describe('Cross-platform tests', () => {
 *     testWindows('should work on Windows', () => {
 *         // ...
 *     });
 * });
 */
export const testWindows = process.platform === 'win32' ? test : test.skip;

/**
 * Use this for Windows-only individual test cases (alias for testWindows).
 */
export const itWindows = process.platform === 'win32' ? it : it.skip;
