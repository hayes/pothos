module.exports = {
  transformIgnorePatterns: [`node_modules`],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
};
