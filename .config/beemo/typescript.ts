import { TypeScriptConfig } from '@beemo/driver-typescript';

const config: TypeScriptConfig = {
  compilerOptions: {
    typeRoots: ['./src/types', './node_modules/@types'],
    sourceMap: true,
    emitDeclarationOnly: false,
    module: 'commonjs',
  },
};

export default config;
