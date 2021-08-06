import { JestConfig } from '@beemo/driver-jest';

const config: JestConfig = {
  timers: 'real',
  coveragePathIgnorePatterns: ['src/index.ts'],
  setupFilesAfterEnv: [],
  moduleNameMapper: {
    '\\.(.*)\\.js': '.$1',
  },
};

export default config;
