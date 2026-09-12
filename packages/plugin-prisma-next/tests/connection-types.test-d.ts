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

// `resolveNode`'s parameter can only be annotated with the model's full row — the helper
// is built long before anyone calls `wrap`. So a callback that mentions its parameter
// would otherwise launder that annotation into the node type and promise columns the
// caller never loaded. `wrap` therefore demands the full row whenever a `resolveNode` is
// configured, which is exactly what the callback already claims to receive.
//
// Each case below is rejected at the `wrap` call, naming the missing columns, rather than
// silently producing a node type with `email`/`lastName` on it.
const narrowRows = [{ id: 'a', firstName: 'Alice' }];

const spreadingNode = prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  resolveNode: (row) => ({ ...row, extra: 1 }),
});

const identityNode = prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  resolveNode: (row) => row,
});

export async function narrowedRowsRejected() {
  const spreading = await spreadingNode.applyPagination(
    ctx.ormClient.User,
    { first: 1 },
    undefined,
    {},
  );
  // @ts-expect-error a spreading callback would claim `email`/`lastName` these rows lack.
  spreading.wrap(narrowRows);

  const identity = await identityNode.applyPagination(
    ctx.ormClient.User,
    { first: 1 },
    undefined,
    {},
  );
  // @ts-expect-error an identity callback would re-declare the node as the full row.
  identity.wrap(narrowRows);

  const wrapper = await wrappedNodes.applyPagination(
    ctx.ormClient.User,
    { first: 1 },
    undefined,
    {},
  );
  // @ts-expect-error the documented wrapper form would put the full row under `.user`.
  wrapper.wrap(narrowRows);

  // The full row satisfies the constraint, so the ordinary path is untouched — the node
  // type is then true, because the callback really did receive what it was annotated with.
  const full = await spreadingNode.applyPagination(ctx.ormClient.User, { first: 1 }, undefined, {});
  const result = full.wrap(await full.collection.all());
  expectTypeOf(result.edges[0]!.node.extra).toEqualTypeOf<number>();
  expectTypeOf(result.edges[0]!.node.email).toEqualTypeOf<string>();
}
