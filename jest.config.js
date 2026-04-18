// Force UTC timezone for deterministic date formatting in tests.
// The TemplateEngine formats dates in local time (matching Outlook's local-time dates),
// so tests must run in a known timezone to produce stable expected values.
process.env.TZ = 'UTC';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  moduleNameMapper: {
    '^(\\.\\./)+src_generated/native_bridge$': '<rootDir>/tests/__mocks__/native_bridge.js',
  },
  rootDir: '.',
};
