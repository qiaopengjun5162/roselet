import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["\.pw\.tsx$"],
  modulePathIgnorePatterns: [
    "<rootDir>/.next",
    "<rootDir>/playwright/.cache",
    "<rootDir>/public/wasm",
  ],
  coveragePathIgnorePatterns: ["\.pw\.tsx$", "/node_modules/"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 85,
      lines: 90,
      statements: 90,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};

export default config;
