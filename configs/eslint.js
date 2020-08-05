module.exports = {
  rules: {
    'class-methods-use-this': 'off',
    'no-restricted-syntax': 'off',
    'import/prefer-default-export': 'off',
    'react/jsx-no-literals': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'no-use-before-define': 'off',
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
