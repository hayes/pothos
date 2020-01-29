module.exports = {
  rules: {
    'class-methods-use-this': 'off',
    'no-restricted-syntax': 'off',
    'import/prefer-default-export': 'off',
    'react/jsx-no-literals': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      files: ['packages/*/test/**/*'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
