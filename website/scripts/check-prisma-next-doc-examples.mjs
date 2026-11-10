import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { parseCodeBlocks } from './doc-code-blocks.mjs';

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
  const lines = block.split('\n');
  const imports = new Set([
    "import SchemaBuilder from '@pothos/core';",
    "import PrismaNextPlugin from '@pothos/plugin-prisma-next';",
    `import { contract, db } from './prisma/${/'auth\./.test(block) ? 'namespaces-db' : 'db'}';`,
    ...lines.filter((line) => line.startsWith('import ')),
  ]);
  const body = lines.filter((line) => !line.startsWith('import ')).join('\n');
  const builder = /\bconst builder\b/.test(body)
    ? ''
    : `const builder = new SchemaBuilder<{ PrismaContract: typeof contract }>({
  plugins: [PrismaNextPlugin],
  prisma: { client: db },
});`;
  return [...imports, builder, body].join('\n');
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
function wrapFragment(block) {
  const lines = block.trimEnd().split('\n');
  const start = lines.findIndex((line) => /^\w+: /.test(line));
  if (start < 0) {
    return block;
  }
  const before = lines.slice(0, start).join('\n');
  const fragment = lines.slice(start).join('\n');
  const wrapped = fragment.startsWith('query:')
    ? `builder.queryField('fragment', (t) =>
  t.prismaConnection({
    type: 'Post',
    ${fragment}
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
      const name = page === readme ? 'README' : basename(page, '.mdx');
      for (const [i, block] of parseCodeBlocks(source, ['ts', 'typescript']).entries()) {
        if (ownModule.test(block)) {
          const file = join(fixture, `${name}-${i}.ts`);
          await writeFile(file, blockModule(block));
          files.push(file);
          checked++;
          continue;
        }
        groups[
          name === 'inheritance' || /'(?:Task|Bug|Feature)'/.test(block) ? 'inheritance' : 'sample'
        ].push(block);
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
        const file = join(fixture, `${name}-${group}.ts`);
        await writeFile(file, pageModule(blocks, contract));
        files.push(file);
      }
    }
    await mkdir(join(fixture, 'prisma'));
    await writeFile(join(fixture, 'prisma/db.ts'), postgresDb('docs-contract'));
    await writeFile(
      join(fixture, 'prisma/namespaces-db.ts'),
      postgresDb('docs-namespaces-contract'),
    );
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
  return { checked };
}
