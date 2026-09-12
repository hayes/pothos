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

const plainNodes = prismaConnectionHelpers(builder, 'User', { cursor: 'id' });

export async function plainNodeShape() {
  const page = await plainNodes.applyPagination(ctx.ormClient.User, { first: 1 }, undefined, {});

  const narrowed = page.wrap([{ id: 'a', firstName: 'Alice' }]);
  expectTypeOf(narrowed).toEqualTypeOf<ConnectionPage<{ id: string; firstName: string }>>();
  expectTypeOf(narrowed.edges[0]!.node).toEqualTypeOf<{ id: string; firstName: string }>();

  const rows = page.wrap(await page.collection.all());
  expectTypeOf(rows.edges[0]!.node.id).toEqualTypeOf<string>();
  expectTypeOf(rows.edges[0]!.cursor).toEqualTypeOf<string>();
}

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

  const full = await spreadingNode.applyPagination(ctx.ormClient.User, { first: 1 }, undefined, {});
  const result = full.wrap(await full.collection.all());
  expectTypeOf(result.edges[0]!.node.extra).toEqualTypeOf<number>();
  expectTypeOf(result.edges[0]!.node.email).toEqualTypeOf<string>();
}

declare const enabled: boolean;

const conditionalNodes = prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  resolveNode: enabled ? (row) => ({ user: row }) : undefined,
});

export async function conditionalNodeShape() {
  const page = await conditionalNodes.applyPagination(
    ctx.ormClient.User,
    { first: 1 },
    undefined,
    {},
  );
  const node = page.wrap(await page.collection.all()).edges[0]!.node;

  // @ts-expect-error the transform may not have run, so the node may still be the raw row.
  node.user;

  if ('user' in node) {
    expectTypeOf(node.user.id).toEqualTypeOf<string>();
  } else {
    expectTypeOf(node.id).toEqualTypeOf<string>();
  }
}

const primitiveNode = prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  resolveNode: (row) => row.firstName,
});

const nullNode = prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  resolveNode: () => null,
});

const promiseNode = prismaConnectionHelpers(builder, 'User', {
  cursor: 'id',
  resolveNode: (row) => Promise.resolve({ user: row }),
});

export async function otherReturnShapes() {
  const primitive = await primitiveNode.applyPagination(
    ctx.ormClient.User,
    { first: 1 },
    undefined,
    {},
  );
  expectTypeOf(
    primitive.wrap(await primitive.collection.all()).edges[0]!.node,
  ).toEqualTypeOf<string>();

  const nulled = await nullNode.applyPagination(ctx.ormClient.User, { first: 1 }, undefined, {});
  expectTypeOf(nulled.wrap(await nulled.collection.all()).edges[0]!.node).toEqualTypeOf<null>();

  const promised = await promiseNode.applyPagination(
    ctx.ormClient.User,
    { first: 1 },
    undefined,
    {},
  );
  const node = promised.wrap(await promised.collection.all()).edges[0]!.node;
  expectTypeOf((await node).user.id).toEqualTypeOf<string>();
}
