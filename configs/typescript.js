module.exports = {
  compilerOptions: {
    typeRoots: ['./src/types', './node_modules/@types'],
    emitDeclarationOnly: !process.beemo.context.argv.includes('--noEmit'),
  },
};
