// JS file that exports schema.  This is used by graphql-code-generator so we
// don't need to compile our typescript code or manually print our schema to
// SDL before generating types for our client side queries.

// Remove non node_modules files from cache so that schema is rebuilt when this file is re-run
Object.keys(require.cache)
  .filter((key) => !key.includes('node_modules'))
  .forEach((key) => {
    delete require.cache[key];
  });

// load schema using @boost/module avoid having to compile typescript files
module.exports = require('@boost/module').requireModule(require.resolve('./schema.ts'));
