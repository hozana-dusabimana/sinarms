module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.js'],
  setupFiles: ['<rootDir>/test/jest.setupEnv.cjs'],
  globalSetup: '<rootDir>/test/jest.globalSetup.cjs',
  clearMocks: true,
};

