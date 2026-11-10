import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  checkDocBlocks,
  importSection,
  located,
  readDocBlocks,
  withoutImports,
} from './doc-block-check.mjs';

// Type-check the inline TypeScript on the Prisma Next pages and the plugin's README. Source includes come from the
// playground example, which `type:examples` already checks.
//
// Each page becomes one module, its blocks in order, so later blocks can use refs that earlier
// blocks define. Blocks run against the plugin's SQLite test contract, or its inheritance contract
// for Task variants. Blocks that create their own builder or only work on PostgreSQL
// (schema-grouped clients, `auth.User`) each become a module of their own, against a PostgreSQL
// docs contract with one namespace, or two for a block naming `auth.`.
const pagesDirectory = 'website/content/docs/plugins/prisma-next';
const readme = 'packages/plugin-prisma-next/README.md';
const ownModule = /orm\.public\b|'auth\.|@prisma\/orm-postgres|new SchemaBuilder\b/;

// The modules of those blocks' clients: `./prisma/db`, which the docs import, and one for a
// contract with two namespaces.
const postgresDb = (contract) => `import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../../tests/fixtures/${contract}';

export declare const contract: Contract;
export const db = postgres({ contract, url: 'postgres://unused' });
`;

// A block of its own, with the imports it leaves out and a builder unless it creates one.
function blockModule(block) {
  const body = withoutImports(block.code);
  const header = importSection(
    [
      "import SchemaBuilder from '@pothos/core';",
      "import PrismaNextPlugin from '@pothos/plugin-prisma-next';",
      `import { contract, db } from './prisma/${/'auth\./.test(block.code) ? 'namespaces-db' : 'db'}';`,
    ],
    [block],
  );
  const builder = /\bconst builder\b/.test(body)
    ? ''
    : `const builder = new SchemaBuilder<{ PrismaContract: typeof contract }>({
  plugins: [PrismaNextPlugin],
  prisma: { client: db },
});`;
  return [header, builder, located(block, body)].join('\n');
}

const preamble = (contract) => `import SchemaBuilder from '@pothos/core';
import PrismaNextPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import sqlite from '@prisma/orm-sqlite/runtime';
import { graphql, type GraphQLSchema } from 'graphql';
import type { Contract } from '${contract}';

declare const contract: Contract;
const db = sqlite({ contract, path: ':memory:' });
declare const schema: GraphQLSchema;
declare const source: string;

const builder = new SchemaBuilder<{
  PrismaContract: Contract;
  Context: { userId: string; isAdmin: boolean };
}>({
  plugins: [RelayPlugin, WithInputPlugin, PrismaNextPlugin],
  prisma: { client: db },
});
`;

// Field fragments, such as `posts: t.relation(...)`, go inside a type that has them.
function wrapFragment(block, body) {
  const fragment = body.split('\n').find((line) => /^\w+: /.test(line));
  if (!fragment) {
    return located(block, body);
  }
  const [open, close] = fragment.startsWith('query:')
    ? [
        "builder.queryField('fragment', (t) =>\n  t.prismaConnection({\n    type: 'Post',",
        '  }),\n);',
      ]
    : ["builder.prismaObject('User', {\n  fields: (t) => ({", '  }),\n});'];
  return `${open}\n${located(block, body)}${close}\n`;
}

function pageModule(blocks, contract) {
  const body = blocks.map((block) => wrapFragment(block, withoutImports(block.code)));
  const declared = blocks.some((block) => /\bconst User\b/.test(block.code));
  return [
    preamble(contract),
    importSection([], blocks),
    declared
      ? ''
      : `const User = builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });`,
    ...body,
  ].join('\n');
}

export async function checkPrismaNextDocExamples(root, tsc) {
  const plugin = join(root, 'packages/plugin-prisma-next');
  const pages = (await readdir(join(root, pagesDirectory)))
    .filter((page) => page.endsWith('.mdx'))
    .sort()
    .map((page) => join(pagesDirectory, page));
  return checkDocBlocks({
    root,
    tsc,
    // Inside the plugin, so the fixture resolves the ORM packages and contracts the plugin's tests use.
    fixtureIn: plugin,
    blocks: await readDocBlocks(root, [...pages, readme]),
    expected: 61,
    build: async (blocks, fixture) => {
      const files = [];
      const pageNames = [...new Set(blocks.map((block) => block.page))];
      for (const page of pageNames) {
        const name = page === readme ? 'README' : basename(page, '.mdx');
        const groups = { sample: [], inheritance: [] };
        for (const [i, block] of blocks.filter((block) => block.page === page).entries()) {
          if (ownModule.test(block.code)) {
            const file = join(fixture, `${name}-${i}.ts`);
            await writeFile(file, blockModule(block));
            files.push(file);
            continue;
          }
          groups[
            name === 'inheritance' || /'(?:Task|Bug|Feature)'/.test(block.code)
              ? 'inheritance'
              : 'sample'
          ].push(block);
        }
        for (const [group, grouped] of Object.entries(groups)) {
          if (!grouped.length) {
            continue;
          }
          const contract =
            group === 'sample'
              ? '../tests/fixtures/sample-contract'
              : '../tests/inheritance/contract';
          const file = join(fixture, `${name}-${group}.ts`);
          await writeFile(file, pageModule(grouped, contract));
          files.push(file);
        }
      }
      await mkdir(join(fixture, 'prisma'));
      await writeFile(join(fixture, 'prisma/db.ts'), postgresDb('docs-contract'));
      await writeFile(
        join(fixture, 'prisma/namespaces-db.ts'),
        postgresDb('docs-namespaces-contract'),
      );
      return {
        files,
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          types: ['node'],
          paths: { '@pothos/plugin-prisma-next': [join(plugin, 'src/index.ts')] },
        },
      };
    },
  });
}
