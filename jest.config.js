const nextJest = require('next/jest');
const createJestConfig = nextJest({
  dir: './',
});
const customJestConfig = {
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testEnvironment: 'jest-environment-jsdom',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/pages/**/*.{js,jsx}',
    'src/components/**/*.{js,jsx}',
    'src/store/**/*.{js,jsx}',
    'src/utils/**/*.{js,jsx}',
  ],
  coverageReporters: ['html', 'text', 'lcov'],
};
module.exports = createJestConfig(customJestConfig);
