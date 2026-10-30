import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { applyCursorPagination, decodeCursor, encodeCursor } from '../src/utils/cursors';
import {
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;

beforeAll(async () => {
  ctx = await createTestRuntime();
});

afterAll(async () => {
  await ctx?.cleanup();
});

function createSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract },
  });
  const cursor = ['title', 'id'] as const;
  builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      posts: t.relatedConnection('posts', {
        cursor,
        args: { newest: t.arg.boolean() },
        orderBy: (post, args) => (args.newest ? post.title.desc() : post.title.asc()),
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaConnection({
        type: 'Post',
        cursor,
        args: { newest: t.arg.boolean() },
        orderBy: (post, args) => (args.newest ? post.title.desc() : post.title.asc()),
        resolve: () => ctx.ormClient.Post,
      }),
      wrongColumn: t.prismaConnection({
        type: 'Post',
        cursor,
        orderBy: (post) => post.id.asc(),
        resolve: () => ctx.ormClient.Post,
      }),
      user: t.prismaField({
        type: 'User',
        resolve: () => ctx.ormClient.User.where({ id: 'u-alice' }),
      }),
    }),
  });
  return builder.toSchema();
}

async function run(source: string) {
  return (await execute({
    schema: createSchema(),
    document: parse(source),
    contextValue: {},
  })) as { data: Record<string, never>; errors?: readonly Error[] };
}

async function allTitles() {
  const rows = await ctx.ormClient.Post.orderBy([(p) => p.title.asc(), (p) => p.id.asc()]).all();
  return rows.map((row) => row.id);
}

const ids = (connection: { edges: { node: { id: string } }[] }) =>
  connection.edges.map((edge) => edge.node.id);

describe('connection orderBy', () => {
  it('sets the direction per request and pages through it', async () => {
    const ascending = await allTitles();
    const up = await run('{ posts(first: 50) { edges { node { id } } } }');
    expect(up.errors).toBeUndefined();
    expect(ids(up.data.posts)).toEqual(ascending);

    const down = await run('{ posts(first: 2, newest: true) { edges { cursor node { id } } } }');
    expect(down.errors).toBeUndefined();
    const descendingTitles = ids(down.data.posts);
    const after = (down.data.posts as { edges: { cursor: string }[] }).edges[0]!.cursor;
    const next = await run(
      `{ posts(first: 1, newest: true, after: "${after}") { edges { node { id } } } }`,
    );
    expect(next.errors).toBeUndefined();
    expect(ids(next.data.posts)).toEqual([descendingTitles[1]]);
  });

  it('reverses for backward pages', async () => {
    const ascending = await allTitles();
    const last = await run('{ posts(last: 1) { edges { node { id } } } }');
    expect(ids(last.data.posts)).toEqual(ascending.slice(-1));
    const newest = await run('{ posts(last: 1, newest: true) { edges { node { id } } } }');
    expect(newest.errors).toBeUndefined();
    expect(ids(newest.data.posts)).toHaveLength(1);
  });

  it('applies inside a related connection', async () => {
    const up = await run('{ user { posts(first: 50) { edges { node { id } } } } }');
    const down = await run('{ user { posts(first: 50, newest: true) { edges { node { id } } } } }');
    expect(up.errors).toBeUndefined();
    expect(down.errors).toBeUndefined();
    const upIds = ids((up.data.user as { posts: never }).posts);
    const downIds = ids((down.data.user as { posts: never }).posts);
    expect(upIds.length).toBeGreaterThan(1);
    expect(new Set(downIds)).toEqual(new Set(upIds));
    expect(downIds[0]).not.toEqual(upIds[0]);
  });

  it('rejects an order over columns outside the cursor order', async () => {
    const result = await run('{ wrongColumn(first: 1) { edges { node { id } } } }');
    expect(result.errors?.[0]?.message).toMatch(/cursor's columns in cursor order/);
  });
});

describe('connection bases', () => {
  it('rejects a distinct Collection', () => {
    expect(() =>
      applyCursorPagination(ctx.ormClient.Post.distinct('title') as never, 'id', { first: 1 }),
    ).toThrow(/distinct/);
  });

  it('accepts native null placement as a preordered prefix', () => {
    const base = ctx.ormClient.Post.orderBy((p) => p.score.desc({ nulls: 'last' }));
    expect(() =>
      applyCursorPagination(
        base as never,
        [{ field: 'score', direction: 'desc', nulls: 'last' }, 'id'],
        { first: 1 },
      ),
    ).not.toThrow();
  });
});

describe('cursor object values', () => {
  class Instant {
    #value: string;

    constructor(value: string) {
      this.#value = value;
    }

    get value() {
      return this.#value;
    }
  }

  const columnCodec = {
    toStored: (value: unknown) => (value as Instant).value,
    fromStored: (stored: unknown) => new Instant(stored as string),
  };

  it('round trips through a column codec', () => {
    const cursor = [{ field: 'at', columnCodec }, 'id'];
    const encoded = encodeCursor(cursor, { at: new Instant('t1'), id: 1 });
    const decoded = decodeCursor(cursor, encoded);
    expect(decoded.at).toBeInstanceOf(Instant);
    expect((decoded.at as Instant).value).toBe('t1');
    expect(decoded.id).toBe(1);
  });

  it('prefers an explicit codec', () => {
    const cursor = [
      {
        field: 'at',
        columnCodec,
        codec: { encode: () => 'explicit', decode: (value: string) => value },
      },
      'id',
    ];
    expect(decodeCursor(cursor, encodeCursor(cursor, { at: new Instant('t1'), id: 1 })).at).toBe(
      'explicit',
    );
  });

  it('refuses an object value it could not restore', () => {
    expect(() => encodeCursor(['at'], { at: new Instant('t1') })).toThrow(/prismaNext.context/);
  });
});
