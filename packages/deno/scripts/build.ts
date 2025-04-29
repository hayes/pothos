import { existsSync, statSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as ts from 'typescript';

const packageDir = path.resolve(__dirname, '../../');
const targetDir = path.resolve(__dirname, '../packages');
const excludedPackages = [
  'converter',
  'deno',
  'plugin-example',
  'plugin-drizzle',
  'plugin-prisma',
  'plugin-prisma-utils',
  'test-utils',
  'plugin-federation',
  'tracing-opentelemetry',
  'tracing-sentry',
  'tracing-newrelic',
  'tracing-xray',
];
const excludedDirs = ['esm', 'lib', 'test', 'tests', 'node_modules', 'prisma'];
const excludedFiles = [
  'package.json',
  'tsconfig.json',
  'tsconfig.type.json',
  'tsconfig.tsbuildinfo',
  'tsconfig.type.tsbuildinfo',
  'CHANGELOG.md',
  '.npmignore',
  'babel.config.js',
];

const moduleMap: Record<string, string> = {
  graphql: 'https://cdn.skypack.dev/graphql?dts',
  zod: 'https://cdn.skypack.dev/zod@v1.11.17?dts',
  dataloader: 'https://cdn.skypack.dev/dataloader?dts',
  '@pothos/core': './core/index.ts',
  '@pothos/plugin-directives': './plugin-directives/index.ts',
};

type LoadedFile = {
  path: string;
  content: Buffer;
};

const modFile = `import Default from './index.ts';
export * from './index.ts';
export default Default;
`;

async function getFiles(dir: string, root = false): Promise<string[]> {
  const results = await fs.readdir(dir, {
    withFileTypes: true,
  });

  const paths = await Promise.all(
    results
      .filter(
        (entry) =>
          !excludedFiles.includes(entry.name) && (!root || !excludedDirs.includes(entry.name)),
      )
      .map((entry): string[] | Promise<string[]> => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return getFiles(fullPath);
        }

        return [fullPath];
      }),
  );

  return paths.flat();
}

async function getPackages() {
  const entries = await fs.readdir(packageDir);

  return entries.filter((entry) => !excludedPackages.includes(entry));
}

async function loadFile(file: string): Promise<LoadedFile> {
  const newPath = path.resolve(targetDir, path.relative(packageDir, file)).replace('/src', '');
  const printer = ts.createPrinter();

  if (file.endsWith('.ts')) {
    const source = ts.createSourceFile(
      file,
      await fs.readFile(file, 'utf-8'),
      ts.ScriptTarget.ESNext,
    );
    const result = ts.transform(source, [importTransformer]);

    return {
      path: newPath,
      content: Buffer.from(`// @ts-nocheck\n${printer.printFile(result.transformed[0])}`, 'utf8'),
    };
  }

  return {
    path: newPath,
    content: await fs.readFile(file),
  };
}

async function getAllFiles() {
  const projects = await getPackages();

  const results = await Promise.all(
    projects.map((dir) => getFiles(path.join(packageDir, dir), true)),
  );

  const files = results.flat();
  const modFiles = projects.map((dir) => ({
    path: path.join(targetDir, dir, 'mod.ts'),
    content: Buffer.from(modFile, 'utf8'),
  }));

  return [...(await Promise.all(files.map((file) => loadFile(file)))), ...modFiles];
}

const importTransformer = (context) => {
  return (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const { moduleSpecifier } = node;
        if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
          const dirName = path.dirname(sourceFile.fileName);
          let mod = moduleSpecifier.text;

          if (mod.startsWith('.')) {
            const modulePath = path.resolve(dirName, mod);
            const tsPath = `${modulePath}.ts`;
            const dtsPath = `${modulePath}.d.ts`;

            const stat = existsSync(modulePath) && statSync(modulePath);
            // biome-ignore lint/complexity/useOptionalChain: <explanation>
            if (stat && stat.isDirectory()) {
              mod = path.join(modulePath, 'index.ts');
            } else if (existsSync(tsPath)) {
              mod = tsPath;
            } else if (existsSync(dtsPath)) {
              mod = dtsPath;
            } else if (!existsSync(modulePath)) {
              throw new Error(`Unable to resolve modulePath ${modulePath}`);
            }

            mod = path.relative(dirName, mod).replace(/^([^\.])/, './$1');
          } else if (moduleMap[mod]) {
            const newMod = moduleMap[mod];

            if (newMod.startsWith('.')) {
              mod = path.relative(dirName.replace('/src', ''), path.resolve(packageDir, newMod));
            } else {
              mod = moduleMap[mod];
            }
          } else {
            throw new Error(`Unknown module ${mod} in ${sourceFile.fileName}`);
          }

          if (ts.isImportDeclaration(node)) {
            return ts.factory.updateImportDeclaration(
              node,
              node.modifiers,
              node.importClause,
              ts.factory.createStringLiteral(mod, true),
              undefined,
            );
          }

          return ts.factory.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            ts.factory.createStringLiteral(mod, true),
            undefined,
          );
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};

async function build() {
  await fs.rm(targetDir, { recursive: true, force: true });

  const files = await getAllFiles();
  const results = files.map(async (file) => {
    await fs.mkdir(path.dirname(file.path), { recursive: true });
    await fs.writeFile(file.path, file.content);
  });
  await Promise.all(results);
}

build().catch((error) => {
  throw error;
});
