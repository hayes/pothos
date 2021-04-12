module.exports = {
  plugins: ['prettier'],
  rules: {
    'class-methods-use-this': 'off',
    'no-restricted-syntax': 'off',
    'import/prefer-default-export': 'off',
    'no-use-before-define': 'off',
    'import/no-extraneous-dependencies': 'off',
    'sort-keys': 'off',
    complexity: 'off',
    'no-eq-null': 'off',
    'no-shadow': 'off',
    'node/no-unsupported-features/node-builtins': [
      'error',
      {
        version: '>=10.0.0',
        ignores: [],
      },
    ],
    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
      },
    },
    {
      files: ['packages/*/tests/**/*'],
      rules: {
        'no-magic-numbers': 'off',
      },
    },
  ],
};
