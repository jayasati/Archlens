/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    '^@archlens/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@archlens/shared-types/(.*)$': '<rootDir>/../../packages/shared-types/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/jest-e2e.setup.ts'],
  testTimeout: 30000,
};
