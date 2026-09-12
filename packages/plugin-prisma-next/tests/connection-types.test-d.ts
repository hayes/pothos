import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
import type { ConnectionPage } from '../src/utils/cursors';
import type { SampleContract, TestRuntimeContext } from './fixtures/runtime';

declare const ctx: TestRuntimeContext;
const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: ctx.contract },
});

builder.queryType({
  fields: (t) => ({
    ordered: t.prismaConnection({
      type: 'Post',
      cursor: ['title', 'id'],
      resolve: () => ctx.ormClient.Post.orderBy((post) => post.title.asc()),
    }),
    nullable: t.prismaConnection({
      type: 'Post',
      cursor: [
        {
          field: 'score',
          nulls: 'first',
          codec: {
            encode: (value) => {
              expectTypeOf(value).toEqualTypeOf<number>();
              return String(value);
            },
            decode: Number,
          },
        },
        'id',
      ],
      resolve: () => ctx.ormClient.Post,
    }),
  }),
});

// `resolveNode` replaces every `edge.node` in place, so `wrap`'s return type has to
// describe the callback's shape rather than the rows that were passed in. Before the
// node shape was inferred, `node.id` typed as `string` while the runtime value was
// `undefined`.
const wrappedNodes = prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  resolveNode: (row) => ({ user: row }),
});

export async function wrappedNodeShape() {
  const page = await wrappedNodes.applyPagination(ctx.ormClient.User, { first: 1 }, undefined, {});
  const result = page.wrap(await page.collection.all());

  // @ts-expect-error `node` is the `{ user: Row }` wrapper, not the row itself.
  result.edges[0]!.node.id;

  expectTypeOf(result.edges[0]!.node.user.id).toEqualTypeOf<string>();
  expectTypeOf(result.edges[0]!.cursor).toEqualTypeOf<string>();
}

// A `resolveNode` returning a union keeps both members on the node, and never collapses
// back to the row.
const unionNodes = prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  resolveNode: (row): { kind: 'user'; user: typeof row } | { kind: 'empty' } =>
    row.firstName ? { kind: 'user', user: row } : { kind: 'empty' },
});

export async function unionNodeShape() {
  const page = await unionNodes.applyPagination(ctx.ormClient.User, { first: 1 }, undefined, {});
  const result = page.wrap(await page.collection.all());

  expectTypeOf(result.edges[0]!.node.kind).toEqualTypeOf<'user' | 'empty'>();
}

// Without `resolveNode` the node is still inferred from the rows handed to `wrap`,
// including rows the caller narrowed before materializing them.
const plainNodes = prismaConnectionHelpers(builder, 'User', { cursor: 'id' });

export async function plainNodeShape() {
  const page = await plainNodes.applyPagination(ctx.ormClient.User, { first: 1 }, undefined, {});

  // Exact whole-type equality, not just the node member: the `Node = never` default has
  // to leave this inference byte-for-byte what it was before the node shape existed.
  const narrowed = page.wrap([{ id: 'a', firstName: 'Alice' }]);
  expectTypeOf(narrowed).toEqualTypeOf<ConnectionPage<{ id: string; firstName: string }>>();
  expectTypeOf(narrowed.edges[0]!.node).toEqualTypeOf<{ id: string; firstName: string }>();

  const rows = page.wrap(await page.collection.all());
  expectTypeOf(rows.edges[0]!.node.id).toEqualTypeOf<string>();
  expectTypeOf(rows.edges[0]!.cursor).toEqualTypeOf<string>();
}
