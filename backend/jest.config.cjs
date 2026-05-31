module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.js'],
  setupFiles: ['<rootDir>/test/jest.setupEnv.cjs'],
  globalSetup: '<rootDir>/test/jest.globalSetup.cjs',
  globalTeardown: '<rootDir>/test/jest.globalTeardown.cjs',
  clearMocks: true,
  // Belt-and-suspenders: even if a stray handle lingers (e.g. a socket from the
  // realtime test), don't let the run hang — exit once tests complete.
  forceExit: true,
};

