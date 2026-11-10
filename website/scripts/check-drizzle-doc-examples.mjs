import { copyFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  checkDocBlocks,
  findBlock,
  importSection,
  located,
  readDocBlocks,
  withoutImports,
} from './doc-block-check.mjs';

// Type-check the inline TypeScript on the Drizzle pages against the playground example's tables.
// Source includes come from the playground example, which `type:examples` already checks.
//
// Each page becomes one module, its blocks in order, so later blocks can use refs that earlier
// blocks define. A page that creates its own builder uses it in place of the shared one.
const pagesDirectory = 'website/content/docs/plugins/drizzle';
const example = 'website/playground-examples/plugin-drizzle';

// Blocks that are not checked.
const skipped = [
  {
    page: 'async-selections.mdx',
    snippet: 'attachments: await attachments.getQuery(args, ctx, nestedSelection, {',
    reason: 'select fragment for a connection helper the page does not define',
  },
  {
    page: 'connection-helpers.mdx',
    snippet: 'const query = attachments.getQuery(args, ctx, info);',
    reason: 'resolver fragment for a connection helper the page does not define',
  },
];

// Blocks with type errors that are not fixed yet, with every error each one has. The check fails
// on any other error in them, and once a listed error no longer occurs.
const knownFailures = [
  // These two are fixed by a pending docs fix. Remove them once it lands.
  {
    page: 'query-planning.mdx',
    snippet: "type: ['posts'],",
    errors: [
      { code: 'TS2322', text: `Type '["posts"]' is not assignable` },
      { code: 'TS2322', text: `Type 'string' is not assignable to type 'RelationsOrderDirection` },
      { code: 'TS2339', text: "Property 'posts' does not exist" },
    ],
  },
  {
    page: 'async-selections.mdx',
    snippet: "type: ['posts'],",
    errors: [
      { code: 'TS2322', text: `Type '["posts"]' is not assignable` },
      { code: 'TS2322', text: `Type 'string' is not assignable to type 'RelationsOrderDirection` },
      { code: 'TS2339', text: "Property 'posts' does not exist" },
    ],
  },

  // The query `t.drizzleQueryFromInfo` returns types its rows with only the listed columns (`{}`
  // with none), and lacks the brand that lets a drizzle ref accept such rows, which the `query` of
  // `t.drizzleField` has. The fix is in the plugin's types.
  {
    page: 'objects.mdx',
    snippet: 'columns: { id: true },',
    errors: [
      {
        code: 'TS2322',
        text: `Type 'SQLiteAsyncRelationalQuery<"async", { id: number; } | undefined>' is not assignable`,
      },
    ],
  },
  {
    page: 'objects.mdx',
    snippet: 'await t.drizzleQueryFromInfo(',
    errors: [{ code: 'TS2322', text: `Type 'Promise<{} | undefined>' is not assignable` }],
  },
];

// Blocks compiled in a module of their own, with the setup they need.
const ownModule = [
  {
    page: 'objects.mdx',
    snippet: 'await t.drizzleQueryFromInfo(',
    // The resolver is written for a builder with AsyncSelections, on the field above it.
    setup: `const builder = new SchemaBuilder<{
  DrizzleRelations: typeof relations;
  AsyncSelections: true;
}>({
  plugins: [DrizzlePlugin],
  drizzle: { client: db, relations, getTableConfig },
});
const User = builder.drizzleObject('users', { name: 'User', fields: () => ({}) });`,
  },
];

const preamble = `import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { db } from './database';
import { relations } from './tables';
`;

const builder = `const builder = new SchemaBuilder<{
  DrizzleRelations: typeof relations;
  Context: { userId: number };
}>({
  relay: { nodesOnConnection: true },
  plugins: [RelayPlugin, WithInputPlugin, DrizzlePlugin],
  drizzle: { client: db, relations, getTableConfig },
});
`;

// What a page uses but defines elsewhere: refs from its includes, imports a block leaves out.
const pageSetup = {
  'interfaces.mdx': `const Viewer = builder.drizzleInterface('users', { variant: 'Viewer', fields: () => ({}) });`,
  'ordering-and-cursors.mdx': `import { pgTable, serial, timestamp } from 'drizzle-orm/pg-core';`,
};

// Fragments go inside the code that takes them: builder options inside a builder, query options
// inside a connection, a resolver inside a User field, and fields inside the User type.
function wrapFragment(block, body) {
  const first = body.split('\n').find((line) => line.trim() && !line.startsWith('//')) ?? '';
  const [open, close] = first.startsWith('plugins:')
    ? [
        'new SchemaBuilder<{ DrizzleRelations: typeof relations }>({\n  drizzle: { client: db, getTableConfig, relations },',
        '});',
      ]
    : first.startsWith('resolve:')
      ? [
          "builder.queryField('fragment', (t) =>\n  t.field({\n    type: User,\n    nullable: true,\n    args: { id: t.arg.int({ required: true }) },",
          '  }),\n);',
        ]
      : first.startsWith('orderBy:')
        ? [
            "builder.queryField('fragment', (t) =>\n  t.drizzleConnection({\n    type: 'posts',\n    resolve: (query) => db.query.posts.findMany(query({",
            '})),\n  }),\n);',
          ]
        : first.startsWith('query(')
          ? [
              "builder.queryField('fragment', (t) =>\n  t.drizzleConnection({\n    type: 'posts',\n    resolve: (query) => db.query.posts.findMany(",
              '),\n  }),\n);',
            ]
          : /^\w+: t\./.test(first)
            ? ["builder.drizzleObjectFields('users', (t) => ({", '}));']
            : [];
  return open ? `${open}\n${located(block, body)}${close}\n` : located(block, body);
}

function pageModule(blocks, setup = '') {
  const body = blocks.map((block) => wrapFragment(block, withoutImports(block.code)));
  const ownBuilder = /\bconst builder\b/.test(setup + blocks.map((block) => block.code).join(''));
  return [
    importSection(preamble.trimEnd().split('\n'), blocks),
    ownBuilder ? '' : builder,
    setup,
    ...body,
  ].join('\n');
}

export async function checkDrizzleDocExamples(root, tsc) {
  const website = join(root, 'website');
  const pages = (await readdir(join(root, pagesDirectory)))
    .filter((page) => page.endsWith('.mdx'))
    .sort()
    .map((page) => join(pagesDirectory, page));
  return checkDocBlocks({
    root,
    tsc,
    // Inside the website, which has the packages the playground example uses.
    fixtureIn: website,
    blocks: await readDocBlocks(root, pages),
    expected: 23,
    skipped,
    knownFailures,
    build: async (blocks, fixture) => {
      // The docs import the example's `./tables` and `./database`.
      await copyFile(join(root, example, 'tables.ts'), join(fixture, 'tables.ts'));
      await copyFile(join(root, example, 'database.ts'), join(fixture, 'database.ts'));
      const files = [];
      const own = new Map(ownModule.map((entry) => [findBlock(blocks, entry, 'ownModule'), entry]));
      for (const [block, entry] of own) {
        const file = join(fixture, `${basename(block.page, '.mdx')}-${block.line}.ts`);
        await writeFile(file, pageModule([block], entry.setup));
        files.push(file);
      }
      for (const page of new Set(blocks.map((block) => block.page))) {
        const file = join(fixture, `${basename(page, '.mdx')}.ts`);
        const grouped = blocks.filter((block) => block.page === page && !own.has(block));
        await writeFile(file, pageModule(grouped, pageSetup[basename(page)]));
        files.push(file);
      }
      return {
        files,
        // As `type:examples` compiles the playground example.
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          paths: {
            'drizzle-orm': [join(website, 'node_modules/drizzle-orm')],
            'drizzle-orm/*': [join(website, 'node_modules/drizzle-orm/*')],
          },
        },
      };
    },
  });
}
