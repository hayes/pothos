module.exports = {
  compilerOptions: {
    typeRoots: ['./src/types', './node_modules/@types'],
    declarationDir: 'dts',
    outDir: 'dts',
    resolveJsonModule: false,
    noEmit: false,
    rootDir: 'src',
    emitDeclarationOnly: true,
  },
};
