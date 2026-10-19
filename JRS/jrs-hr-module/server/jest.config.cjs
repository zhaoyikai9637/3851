/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/jest-tests/**/*.test.js'],
  transform: {},
  collectCoverageFrom: [
    '<rootDir>/src/validation.js',
    '<rootDir>/src/database-safety.js',
    '<rootDir>/src/mailer.js',
    '<rootDir>/src/cloud-sync.js',
    '<rootDir>/src/original-content.js'
  ],
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/../work/jest-coverage',
  coverageReporters: ['json-summary', 'text-summary']
};
