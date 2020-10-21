module.exports = {
  rules: {
    'class-methods-use-this': 'off',
    'no-restricted-syntax': 'off',
    'import/prefer-default-export': 'off',
    'react/jsx-no-literals': 'off',
    'no-use-before-define': 'off',
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
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['packages/*/tests/**/*'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'no-magic-numbers': 'off',
      },
    },
  ],
};
