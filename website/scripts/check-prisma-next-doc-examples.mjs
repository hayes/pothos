import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { parseCodeBlocks } from './doc-code-blocks.mjs';

// Type-check the inline TypeScript on the Prisma Next pages and the plugin's README. Source includes come from the
// playground example, which `type:examples` already checks.
//
// Each page becomes one module, its blocks in order, so later blocks can use refs that earlier
// blocks define. Blocks run against the plugin's SQLite test contract, or its inheritance contract
// for Task variants. Postgres-only blocks (schema-grouped clients, `auth.User`) have no matching
// contract and are skipped, as are blocks that create their own builder.
const pagesDirectory = 'website/content/docs/plugins/prisma-next';
const readme = 'packages/plugin-prisma-next/README.md';
const skip = /orm\.public\b|'auth\.|@prisma\/orm-postgres|new SchemaBuilder\b/;

const preamble = (contract) => `import SchemaBuilder from '@pothos/core';
import prismaNextPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import sqlite from '@prisma/orm-sqlite/runtime';
import { graphql, type GraphQLSchema } from 'graphql';
import type { Contract } from '${contract}';

declare const contract: Contract;
const db = sqlite({ contract, path: ':memory:' });
declare const schema: GraphQLSchema;
declare const source: string;

const builder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  Context: { db: typeof db; userId: string; isAdmin: boolean };
}>({
  plugins: [RelayPlugin, prismaNextPlugin],
  prismaNext: { client: db },
});
`;

// Field fragments, such as `posts: t.relation(...)`, go inside a type that has them.
function wrapFragment(block) {
  const lines = block.trimEnd().split('\n');
  const start = lines.findIndex((line) => /^\w+: /.test(line));
  if (start < 0) {
    return block;
  }
  const before = lines.slice(0, start).join('\n');
  const fragment = lines.slice(start).join('\n');
  const wrapped = fragment.startsWith('orderBy:')
    ? `builder.queryField('fragment', (t) =>
  t.prismaConnection({
    type: 'Post',
    ${fragment}
    resolve: (_root, _args, ctx) => ctx.db.orm.Post,
  }),
);`
    : `builder.prismaObject('User', {
  fields: (t) => ({
    ${fragment}
  }),
});`;
  return `${before}\n${wrapped}\n`;
}

function pageModule(blocks, contract) {
  const imports = new Set();
  const body = blocks.map((block) =>
    wrapFragment(
      block
        .split('\n')
        .filter((line) => !(line.startsWith('import ') && imports.add(line)))
        .join('\n'),
    ),
  );
  const declared = body.join('\n').match(/\bconst User\b/);
  return [
    preamble(contract),
    ...imports,
    declared
      ? ''
      : `const User = builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });`,
    ...body,
  ].join('\n');
}

export async function checkPrismaNextDocExamples(root, tsc) {
  const plugin = join(root, 'packages/plugin-prisma-next');
  // Inside the plugin, so the fixture resolves the ORM packages and contracts the plugin's tests use.
  const fixture = await mkdtemp(join(plugin, '.docs-check-'));
  let checked = 0;
  let skipped = 0;
  try {
    const files = [];
    const pages = (await readdir(join(root, pagesDirectory)))
      .filter((page) => page.endsWith('.mdx'))
      .sort()
      .map((page) => join(pagesDirectory, page));
    for (const page of [...pages, readme]) {
      const source = (await readFile(join(root, page), 'utf8')).replace(
        /<include(?:regions)?\b[^>]*>[^<]*<\/include(?:regions)?>/g,
        '',
      );
      const groups = { sample: [], inheritance: [] };
      for (const block of parseCodeBlocks(source, ['ts', 'typescript'])) {
        if (skip.test(block)) {
          skipped++;
          continue;
        }
        groups[/'(?:Task|Bug|Feature)'/.test(block) ? 'inheritance' : 'sample'].push(block);
        checked++;
      }
      for (const [group, blocks] of Object.entries(groups)) {
        if (!blocks.length) {
          continue;
        }
        const contract =
          group === 'sample'
            ? '../tests/fixtures/sample-contract'
            : '../tests/inheritance/contract';
        const name = page === readme ? 'README' : basename(page, '.mdx');
        const file = join(fixture, `${name}-${group}.ts`);
        await writeFile(file, pageModule(blocks, contract));
        files.push(file);
      }
    }
    await writeFile(
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
          paths: { '@pothos/plugin-prisma-next': [join(plugin, 'src/index.ts')] },
        },
        files,
      }),
    );
    execFileSync(process.execPath, [tsc, '-p', fixture], {
      cwd: dirname(fixture),
      stdio: 'inherit',
    });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
  return { checked, skipped };
}
