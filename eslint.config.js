const globals = require('globals');
const { parserOptions, ...moon } = require('eslint-config-moon');
// const moonNode = require('eslint-config-moon/node');

const brokenRules = [
  'unicorn/import-index',
  'import/no-mutable-exports',
  'import/newline-after-import',
  'promise/no-return-wrap',
  'import/no-commonjs',
  'promise/no-nesting',
  'promise/no-multiple-resolved',
  'promise/no-promise-in-callback',
  'import/no-amd',
];

function flattenConfig({
  plugins = [],
  parserOptions,
  parser,
  extends: configs,
  env,
  globals,
  reportUnusedDisableDirectives,
  overrides,
  rules,
  ...rest
}) {
  if (rules) {
    for (const rule of brokenRules) {
      if (rules[rule]) {
        delete rules[rule];
      }
    }
  }
  return [
    ...(configs?.flatMap((config) =>
      flattenConfig(config.startsWith('/') ? require(config) : require(`eslint-config-${config}`)),
    ) ?? []),
    {
      plugins: plugins.reduce(
        (obj, plugin) => ({
          ...obj,
          [plugin]: plugin.startsWith('@')
            ? require(plugin.slice(1)).plugin
            : require(`eslint-plugin-${plugin}`),
        }),
        {},
      ),
      linterOptions: {
        reportUnusedDisableDirectives: true,
      },

      languageOptions: {
        parser: require('@typescript-eslint/parser'),
        parserOptions: {
          ...parserOptions,
          tsconfigRootDir: __dirname,
          project: 'tsconfig.eslint.json',
        },
        globals: { ...globals },
      },
      rules: {
        ...rules,
      },
      ...rest,
    },
    ...(overrides ?? []).flatMap((override) => flattenConfig(override)),
  ];
}
const ignores = [
  '.*.js',
  '.turbo',
  '*.generated.ts',
  '*.generated.ts',
  '*.generated.tsx',
  '*.tsbuildinfo',
  '**/*.d.cts',
  '**/*.d.mts',
  '**/*.d.ts',
  '**/*.map',
  '**/*.min.js',
  '**/*.snap',
  '**/build/',
  '**/cjs/',
  '**/coverage/',
  '**/dist/',
  '**/dts/',
  '**/esm/',
  '**/lib/',
  '**/mjs/',
  '**/node_modules/',
  '**/umd/',
  'eslint.config.js',
  'examples/*/prisma',
  'examples/*/prisma/generated.ts',
  'generated.ts',
  'packages/*/prisma',
  'packages/*/tests/generated.ts',
  'packages/deno/',
  'packages/plugin-prisma-utils/bin/generator.js',
  'packages/plugin-prisma-utils/tests/client',
  'packages/plugin-prisma/bin/generator.js',
  'packages/plugin-prisma/prisma',
  'packages/plugin-prisma/tests/client',
  'packages/plugin-prisma/tests/generated.ts',
  'scripts',
  'tests/client/*',
  'website/public',
  'website/tailwind.config.js',
  'website/util/search-index.js',
  'website/.next/*',
];

module.exports = [
  {
    ignores,
  },
  ...flattenConfig(moon),
  // moonNode,
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ...parserOptions,
        tsconfigRootDir: __dirname,
        project: 'tsconfig.eslint.json',
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'import/no-cycle': 2,
      'import/no-unresolved': 'off',
      'import/no-default-export': 'off',
      'sort-keys': 'off',
      'promise/prefer-await-to-callbacks': 'off',
      'node/no-unpublished-import': 'off',
      'promise/prefer-await-to-then': 'off',
      complexity: 'off',
      'import/no-extraneous-dependencies': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/sort-type-union-intersection-members': 'off',
      '@typescript-eslint/key-spacing': 'off',
    },
  },
  {
    files: ['{packages,examples,website}/**/*.js', '{packages,examples,website}/**/*.mjs'],

    rules: {
      'import/no-commonjs': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['packages/*/tests/**/*'],

    rules: {
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/*/tests/examples?/**/*', 'examples/**/*'],

    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      'import/extensions': 'off',
    },
  },
];
