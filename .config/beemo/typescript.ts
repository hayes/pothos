import { TypeScriptConfig } from '@beemo/driver-typescript';

const config: TypeScriptConfig = {
  compilerOptions: {
    typeRoots: ['./src/types', './node_modules/@types'],
    sourceMap: true,
    emitDeclarationOnly: false,
    module: process.env.ESM_BUILD === 'true' ? 'es2020' : 'commonjs',
    target: 'es2019'
  },
};

export default config;
