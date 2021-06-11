const config = {
  module: '@beemo/dev',
  drivers: {
    babel: true,
    eslint: {
      args: ['--cache-location', './node_modules/.cache/eslint', '--cache'],
    },
    jest: true,
    prettier: true,
    typescript: {
      buildFolder: process.env.ESM_BUILD === 'true' ? 'esm' : 'lib',
    },
  },
  settings: {
    useBuiltIns: false,
    node: true,
  },
};

export default config;
