module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
  },
  globalSetup: '<rootDir>/tests/e2e/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/e2e/globalTeardown.ts',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
    }],
  },
  // Run tests sequentially to ensure proper order
  maxWorkers: 1,
  // Use custom test sequencer to ensure correct order
  testSequencer: '<rootDir>/tests/e2e/testSequencer.js',
};
