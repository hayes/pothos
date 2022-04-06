module.exports = {
  transformIgnorePatterns: [`node_modules`, 'tests/client'],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
};
