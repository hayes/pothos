import { copyFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { checkDocBlocks, hoistImports, located, readDocBlocks } from './doc-block-check.mjs';

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
    page: 'setup.mdx',
    snippet: 'plugins: [RelayPlugin, DrizzlePlugin],',
    reason: 'builder options fragment',
  },
  {
    page: 'setup.mdx',
    snippet: 'plugins: [RelayPlugin, WithInputPlugin, DrizzlePlugin],',
    reason: 'builder options fragment',
  },
  {
    page: 'ordering-and-cursors.mdx',
    snippet: "export const posts = pgTable('posts', {",
    reason: 'PostgreSQL table; the example tables are SQLite',
  },
  {
    page: 'objects.mdx',
    snippet: 'resolve: async (_root, args, context, info) =>',
    reason: 'resolver fragment of the field above it, for a builder with AsyncSelections',
  },
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

// Blocks with type errors that are not fixed yet. The check fails once one of them passes.
const knownFailures = [
  // These two are fixed by a pending docs fix. Remove them once it lands.
  {
    page: 'query-planning.mdx',
    snippet: "type: ['posts'],",
    error: `Type '["posts"]' is not assignable`,
  },
  {
    page: 'async-selections.mdx',
    snippet: "type: ['posts'],",
    error: `Type '["posts"]' is not assignable`,
  },
  // The rows a `t.drizzleQueryFromInfo` query loads are typed with only the columns it lists, so
  // they are not assignable to the page's User type. Not decided yet whether the docs or the types
  // change.
  {
    page: 'objects.mdx',
    snippet: 'columns: { id: true },',
    error: `Type 'SQLiteAsyncRelationalQuery<"async", { id: number; } | undefined>' is not assignable`,
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

// Refs a page uses that its includes define.
const pageSetup = {
  'interfaces.mdx': `const Viewer = builder.drizzleInterface('users', { variant: 'Viewer', fields: () => ({}) });`,
};

// Fragments go inside the code that takes them: query options inside a connection, and fields
// inside the User type.
function wrapFragment(block, body) {
  const first = body.split('\n').find((line) => line.trim() && !line.startsWith('//'));
  const [open, close] = first.startsWith('orderBy:')
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
  const imports = new Set(preamble.trimEnd().split('\n'));
  const body = blocks.map((block) => {
    const hoisted = hoistImports(block.code);
    for (const line of hoisted.imports) {
      imports.add(line);
    }
    return wrapFragment(block, hoisted.body);
  });
  const ownBuilder = blocks.some((block) => /\bconst builder\b/.test(block.code));
  return [...imports, ownBuilder ? '' : builder, setup, ...body].join('\n');
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
    expected: 19,
    skipped,
    knownFailures,
    build: async (blocks, fixture) => {
      // The docs import the example's `./tables` and `./database`.
      await copyFile(join(root, example, 'tables.ts'), join(fixture, 'tables.ts'));
      await copyFile(join(root, example, 'database.ts'), join(fixture, 'database.ts'));
      const files = [];
      for (const page of new Set(blocks.map((block) => block.page))) {
        const file = join(fixture, `${basename(page, '.mdx')}.ts`);
        const grouped = blocks.filter((block) => block.page === page);
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
