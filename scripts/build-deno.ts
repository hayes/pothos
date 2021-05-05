import * as fs from 'fs/promises';
import { statSync, existsSync } from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const packageDir = path.resolve(__dirname, '../packages');
const targetDir = path.resolve(__dirname, '../deno/packages');
const excludedPackages = ['converter'];
const excludedDirs = ['lib', 'test', 'tests', 'node_modules'];
const excludedFiles = ['package.json', 'tsconfig.json', 'tsconfig.tsbuildinfo'];

const moduleMap: Record<string, string> = {
  graphql: 'https://cdn.skypack.dev/graphql@v15.5.0?dts',
  zod: 'https://cdn.skypack.dev/zod@v1.11.17?dts',
  '@giraphql/core': './core/index.ts',
};

type LoadedFile = {
  path: string;
  content: Buffer;
};

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

  return paths.flatMap((entry) => entry);
}

async function getPackages() {
  const entries = await fs.readdir(packageDir);

  return entries.filter((entry) => !excludedPackages.includes(entry));
}

async function loadFile(program: ts.Program, file: string): Promise<LoadedFile> {
  const newPath = path.resolve(targetDir, path.relative(packageDir, file)).replace('/src', '');
  const printer = ts.createPrinter();

  if (file.endsWith('.ts')) {
    // const source = program.getSourceFile(file)!;
    const source = ts.createSourceFile(
      file,
      await fs.readFile(file, 'utf-8'),
      ts.ScriptTarget.ESNext,
    );
    const result = ts.transform(source, [importTransformer]);

    ts;

    return {
      path: newPath,
      content: Buffer.from(printer.printFile(result.transformed[0]), 'utf8'),
    };
  } else {
    return {
      path: newPath,
      content: await fs.readFile(file),
    };
  }
}

async function getAllFiles() {
  const projects = await getPackages();

  const results = await Promise.all(
    projects.map((dir) => getFiles(path.join(packageDir, dir), true)),
  );

  const files = results.flatMap((entry) => entry);

  const program = ts.createProgram(
    files.filter((file) => file.endsWith('.ts')),
    {},
  );

  return Promise.all(files.map((file) => loadFile(program, file)));
}

const importTransformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
  return (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const { moduleSpecifier } = node;
        if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
          const dirName = path.dirname(sourceFile.fileName);
          let mod = moduleSpecifier.text;

          if (mod.startsWith('.')) {
            const modulePath = path.resolve(dirName, mod);
            const tsPath = modulePath + '.ts';
            const dtsPath = modulePath + '.d.ts';

            const stat = existsSync(modulePath) && statSync(modulePath);
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
            throw new Error(`Unknown module ${mod}`);
          }

          if (ts.isImportDeclaration(node)) {
            return ts.factory.updateImportDeclaration(
              node,
              node.decorators,
              node.modifiers,
              node.importClause,
              ts.factory.createStringLiteral(mod, true),
            );
          }

          return ts.factory.updateExportDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            ts.factory.createStringLiteral(mod, true),
          );
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};

async function build() {
  await fs.rmdir(targetDir, { recursive: true });

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
