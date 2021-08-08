import { ESLintConfig } from '@beemo/driver-eslint';
import { resolve } from 'path';

const config: ESLintConfig = {
  plugins: ['prettier'],
  ignore: ['deno', 'scripts', 'packages/plugin-prisma/prisma'],
  rules: {
    'import/extensions': [
      'error',
      {
        js: 'always',
        ts: 'always',
      },
    ],
    'import/no-useless-path-segments': 'off',
    'import/no-unresolved': 'off',
    'import/no-default-export': 'off',
    'prettier/prettier': 'error',
    'sort-keys': 'off',
    'promise/prefer-await-to-callbacks': 'off',
    'node/no-unpublished-import': 'off',
    'promise/prefer-await-to-then': 'off',
    complexity: 'off',
    'import/no-extraneous-dependencies': 'off',
    '@typescript-eslint/no-namespace': 'off',
  },
  overrides: [
    {
      files: ['packages/*/tests/**/*'],
      rules: {
        'no-magic-numbers': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        'import/extensions': 'off',
      },
    },
    {
      files: ['packages/*/tests/examples?/**/*'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};

export default config;
