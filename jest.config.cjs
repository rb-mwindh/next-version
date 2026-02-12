/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ["**/*.spec.ts"],

  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.spec.json',
      useESM: true,
    }],
  },

  moduleNameMapper: {
    "^(\\.{1,2}\.*)\\.js$": "$1",
  },
}
