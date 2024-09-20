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
