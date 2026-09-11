import { docCodeBlocks } from './doc-code-blocks.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'package.json'));
const fixture = await mkdtemp(join(root, '.docs-check-'));

const codeBlocks = (page, language) => docCodeBlocks(join(root, 'website'), page, language);

try {
  const guide = await codeBlocks('guide/index.mdx', 'typescript');
  const overview = await codeBlocks('index.mdx', 'typescript');
  const printing = await codeBlocks('guide/printing-schemas.mdx', 'typescript');
  const queries = await codeBlocks('guide/index.mdx', 'graphql');
  const json = await codeBlocks('guide/index.mdx', 'json');
  assert.equal(guide.length, 2, 'Expected schema and server snippets in the guide');
  assert.equal(overview.length, 1, 'Expected one overview schema');
  assert.equal(printing.length, 1, 'Expected one printing example');
  assert.equal(queries.length, 1, 'Expected one guide query');
  assert.equal(json.length, 2, 'Expected tsconfig and response JSON');

  await Promise.all([
    writeFile(join(fixture, 'package.json'), '{"type":"commonjs"}\n'),
    writeFile(join(fixture, 'schema.ts'), guide[0]),
    writeFile(join(fixture, 'overview.ts'), overview[0]),
    writeFile(join(fixture, 'printing.ts'), printing[0]),
    writeFile(join(fixture, 'query.graphql'), queries[0]),
    writeFile(join(fixture, 'expected.json'), json[1]),
    writeFile(
      join(fixture, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          esModuleInterop: true,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: ['node'],
          paths: { '@pothos/core': ['../packages/core/src/index.ts'] },
        },
        include: ['*.ts'],
      }),
    ),
    writeFile(
      join(fixture, 'check.mjs'),
      await readFile(join(root, 'website/scripts/doc-example-assertions.mjs'), 'utf8'),
    ),
  ]);

  execFileSync(
    process.execPath,
    [join(dirname(require.resolve('typescript/package.json')), 'bin/tsc'), '-p', fixture],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  execFileSync(
    process.execPath,
    [require.resolve('tsx/cli'), '--tsconfig', join(fixture, 'tsconfig.json'), 'check.mjs'],
    { cwd: fixture, stdio: 'inherit' },
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}
