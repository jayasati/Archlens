/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.integration-spec\\.ts$',
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
    '^@archlens/shared-types$': '<rootDir>/../../packages/shared-types/dist/index.js',
    '^@archlens/shared-types/(.*)$': '<rootDir>/../../packages/shared-types/dist/$1',
    '^@archlens/ir-schema$': '<rootDir>/../../packages/ir-schema/dist/index.js',
    '^@archlens/ir-schema/(.*)$': '<rootDir>/../../packages/ir-schema/dist/$1',
  },
  setupFiles: ['<rootDir>/test/integration.setup.ts'],
  testTimeout: 120000,
  forceExit: true,
};
