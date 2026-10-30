// Installs the packed plugin into a fresh project, then checks ESM and CommonJS imports, strict
// declaration checks for both module formats, and a real SQLite GraphQL query.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pluginDir = join(root, 'packages/plugin-prisma-next');
const consumer = mkdtempSync(join(tmpdir(), 'pothos-prisma-next-consumer-'));
const tarballs = join(consumer, 'tarballs');

function run(command, args, cwd = consumer) {
  console.log(`$ ${command} ${args.join(' ')}`);
  return execFileSync(command, args, { cwd, stdio: 'inherit' });
}

const pack = (name) => {
  const output = execFileSync(
    'pnpm',
    ['--filter', name, 'pack', '--pack-destination', tarballs, '--json'],
    { cwd: root, encoding: 'utf8' },
  );
  return `file:${JSON.parse(output).filename}`;
};

const manifest = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'));
const ormVersion = manifest.peerDependencies['@prisma/orm-framework'];
const workspacePackages = {
  '@pothos/core': pack('@pothos/core'),
  '@pothos/plugin-prisma-next': pack('@pothos/plugin-prisma-next'),
  '@pothos/plugin-relay': pack('@pothos/plugin-relay'),
  '@pothos/plugin-with-input': pack('@pothos/plugin-with-input'),
  '@pothos/selection-mapper': pack('@pothos/selection-mapper'),
};

writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({
    name: 'consumer',
    private: true,
    dependencies: {
      ...workspacePackages,
      '@prisma/orm-family-sql': ormVersion,
      '@prisma/orm-framework': ormVersion,
      '@prisma/orm-sqlite': ormVersion,
      '@types/node': '^24.0.0',
      graphql: '^16.10.0',
      typescript: '5.9.3',
    },
    overrides: workspacePackages,
  }),
);

for (const name of ['sample-contract.json', 'sample-contract.d.ts']) {
  copyFileSync(join(pluginDir, 'tests/fixtures', name), join(consumer, name));
}

writeFileSync(
  join(consumer, 'esm.mjs'),
  `import { strictEqual } from 'node:assert';
import plugin, { prismaConnectionHelpers } from '@pothos/plugin-prisma-next';
strictEqual(plugin, 'prismaNext');
strictEqual(typeof prismaConnectionHelpers, 'function');
`,
);
writeFileSync(
  join(consumer, 'cjs.cjs'),
  `const { strictEqual } = require('node:assert');
const { default: plugin, prismaConnectionHelpers } = require('@pothos/plugin-prisma-next');
strictEqual(plugin, 'prismaNext');
strictEqual(typeof prismaConnectionHelpers, 'function');
`,
);

const typeCheck = (contractImport) => `import SchemaBuilder from '@pothos/core';
import prismaNextPlugin, { type Row, prismaConnectionHelpers } from '@pothos/plugin-prisma-next';
import type { Contract } from '${contractImport}';

declare const contract: Contract;
type Types = { PrismaNextContract: Contract };
const builder = new SchemaBuilder<Types>({ plugins: [prismaNextPlugin], prismaNext: { contract } });
builder.prismaObject('User', {
  fields: (t) => ({ firstName: t.exposeString('firstName'), posts: t.relation('posts') }),
});
builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
export const name: string = prismaNextPlugin;
export type User = Row<PothosSchemaTypes.ExtendDefaultTypes<Types>, 'User'>;
export const helpers = prismaConnectionHelpers;
`;
writeFileSync(join(consumer, 'check.mts'), typeCheck('./sample-contract.js'));
writeFileSync(join(consumer, 'check.ts'), typeCheck('./sample-contract'));
// Without `"type": "module"`, nodenext checks `.mts` as ESM and `.ts` as CommonJS.
for (const [file, entry] of [
  ['tsconfig.esm.json', 'check.mts'],
  ['tsconfig.cjs.json', 'check.ts'],
]) {
  writeFileSync(
    join(consumer, file),
    JSON.stringify({
      compilerOptions: {
        module: 'nodenext',
        moduleResolution: 'nodenext',
        target: 'es2022',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: ['node'],
      },
      files: [entry],
    }),
  );
}

writeFileSync(
  join(consumer, 'query.mjs'),
  `import { strictEqual, deepStrictEqual } from 'node:assert';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import SchemaBuilder from '@pothos/core';
import prismaNextPlugin from '@pothos/plugin-prisma-next';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import { graphql } from 'graphql';

const contract = contractFromJson(
  JSON.parse(readFileSync(new URL('./sample-contract.json', import.meta.url), 'utf8')),
);
const path = join(mkdtempSync(join(tmpdir(), 'pothos-prisma-next-query-')), 'test.db');
const database = new DatabaseSync(path);
database.exec(\`
  CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, firstName TEXT NOT NULL, lastName TEXT NOT NULL, email TEXT NOT NULL UNIQUE);
  CREATE TABLE post (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, score REAL, authorId TEXT NOT NULL, createdAt TEXT NOT NULL);
  INSERT INTO user VALUES ('u1', 'Ada', 'L', 'a@example.com');
  INSERT INTO post VALUES ('p1', 'One', 'c', 1, NULL, 'u1', '2026-01-01T00:00:00.000Z');
\`);
database.close();

const statements = [];
const client = sqlite({
  contract,
  middleware: [
    {
      name: 'capture',
      familyId: 'sql',
      async beforeEncode(plan) {
        statements.push(plan.sql);
      },
    },
  ],
});
const runtime = await client.connect({ path });
const builder = new SchemaBuilder({ plugins: [prismaNextPlugin], prismaNext: { contract } });
builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
builder.prismaObject('User', {
  fields: (t) => ({ firstName: t.exposeString('firstName'), posts: t.relation('posts') }),
});
builder.queryType({
  fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => client.orm.User }) }),
});
const result = await graphql({
  schema: builder.toSchema(),
  source: '{ users { firstName posts { title } } }',
  contextValue: {},
});
deepStrictEqual(JSON.parse(JSON.stringify(result)), {
  data: { users: [{ firstName: 'Ada', posts: [{ title: 'One' }] }] },
});
strictEqual(statements.length, 1);
await runtime.close();
`,
);

run('npm', ['install', '--no-audit', '--no-fund']);
run('node', ['esm.mjs']);
run('node', ['cjs.cjs']);
run('npx', ['tsc', '--project', 'tsconfig.esm.json']);
run('npx', ['tsc', '--project', 'tsconfig.cjs.json']);
run('node', ['query.mjs']);
console.log('Consumer check passed.');
