// biome-ignore-all lint/suspicious/noExplicitAny: untyped contract fixture and dynamic builders
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import { execute, type GraphQLSchema, parse, printSchema } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { encodeCursor } from '../src/utils/cursors';
import { createTestRuntime, type TestRuntimeContext, withCapture } from './fixtures/runtime';

const contract = contractFromJson<any>(
  JSON.parse(readFileSync(new URL('./fixtures/collision-contract.json', import.meta.url), 'utf8')),
) as any;

let ctx: TestRuntimeContext;
let orm: any;
let runtime: any;
let dir: string;

beforeAll(async () => {
  ctx = await createTestRuntime();
  dir = mkdtempSync(join(tmpdir(), 'pothos-collision-'));
  const path = join(dir, 'test.db');
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE sheet (id INTEGER PRIMARY KEY, name TEXT NOT NULL, meta TEXT, role TEXT, count INTEGER);
    CREATE TABLE "row" (id INTEGER PRIMARY KEY, sheetId INTEGER NOT NULL, label TEXT NOT NULL);
    CREATE TABLE note (id INTEGER PRIMARY KEY, sheetId INTEGER NOT NULL, text TEXT, uniq TEXT UNIQUE);
    CREATE TABLE owner (id INTEGER PRIMARY KEY);
    CREATE TABLE profile (id INTEGER PRIMARY KEY, ownerId INTEGER NOT NULL UNIQUE);
    INSERT INTO sheet VALUES (1, 's1', '{"role:role":"admin","x:role":"admin"}', 'user', 99);
    INSERT INTO "row" VALUES (10, 1, 'r10'), (11, 1, 'r11');
    INSERT INTO note VALUES (20, 1, 'n20', 'u'), (21, 1, NULL, NULL);
    INSERT INTO owner VALUES (1), (2);
    INSERT INTO profile VALUES (5, 1);
  `);
  db.close();
  const client = sqlite<any>({ contract });
  runtime = await client.connect({ path });
  orm = client.orm;
});

afterAll(async () => {
  await runtime?.close();
  await ctx?.cleanup();
  rmSync(dir, { recursive: true, force: true });
});

const collisionBuilder = (extra: object = {}): any =>
  new SchemaBuilder<any>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract, ...extra },
  } as never);

const sampleBuilder = (extra: object = {}): any =>
  new SchemaBuilder<any>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract, ...extra },
  } as never);

const run = async (schema: GraphQLSchema, query: string) => {
  const captures: { sql: string }[] = [];
  const result: any = await withCapture(
    captures as never,
    async () => await execute({ schema, document: parse(query), contextValue: {} }),
  );
  return { ...result, captures };
};

function callbackQuerySchema(provider: boolean) {
  const o: any = ctx.ormClient;
  const builder = sampleBuilder(provider ? { collections: o } : {});
  builder.prismaObject('User', {
    fields: (t: any) => ({ id: t.exposeID('id'), email: t.exposeString('email') }),
  });
  builder.prismaObject('Post', {
    fields: (t: any) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      author: t.relation('author', {
        query: () => ({ where: (u: any) => u.id.neq('nobody') }),
      }),
    }),
  });
  builder.queryType({
    fields: (t: any) => ({
      posts: t.prismaField({
        type: ['Post'],
        resolve: () => o.Post.orderBy((p: any) => p.id.asc()).limit(2),
      }),
    }),
  });
  return builder.toSchema();
}

describe('callback queries across fragments', () => {
  for (const provider of [false, true]) {
    it(`merges one to-one field selected twice (provider: ${provider})`, async () => {
      const result = await run(
        callbackQuerySchema(provider),
        '{ posts { id author { id } ... on Post { author { email } } } }',
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.posts[0].author).toEqual({
        id: expect.any(String),
        email: expect.any(String),
      });
      expect(result.captures).toHaveLength(1);
    });
  }

  for (const provider of [false, true]) {
    it(`merges one to-many field selected twice (provider: ${provider})`, async () => {
      const o: any = ctx.ormClient;
      const builder = sampleBuilder(provider ? { collections: o } : {});
      builder.prismaObject('Comment', { fields: (t: any) => ({ id: t.exposeID('id') }) });
      builder.prismaObject('Post', {
        fields: (t: any) => ({
          id: t.exposeID('id'),
          title: t.exposeString('title'),
          cc: t.relatedConnection('comments', { cursor: 'id', totalCount: true }),
        }),
      });
      builder.prismaObject('User', {
        fields: (t: any) => ({
          id: t.exposeID('id'),
          posts: t.relation('posts', { query: () => ({ orderBy: (p: any) => p.id.asc() }) }),
        }),
      });
      builder.queryType({
        fields: (t: any) => ({
          users: t.prismaField({
            type: ['User'],
            resolve: () => o.User.orderBy((u: any) => u.id.asc()),
          }),
        }),
      });
      const schema = builder.toSchema();
      const simple = await run(schema, '{ users { posts { id } ... { posts { title } } } }');
      expect(simple.errors).toBeUndefined();
      expect(simple.data.users[0].posts[0]).toEqual({
        id: expect.any(String),
        title: expect.any(String),
      });
      expect(simple.captures).toHaveLength(1);

      const nested = await run(
        schema,
        '{ users { posts { cc(first: 1) { totalCount } } ... { posts { cc(first: 1) { edges { node { id } } } } } } }',
      );
      expect(nested.errors).toBeUndefined();
    });
  }
});

describe('model members that share a name with plugin slots', () => {
  function schema() {
    const builder = collisionBuilder();
    builder.prismaObject('Row', {
      fields: (t: any) => ({ id: t.exposeID('id', { nullable: false }) }),
    });
    builder.prismaObject('Note', {
      fields: (t: any) => ({ id: t.exposeID('id', { nullable: false }) }),
    });
    builder.prismaObject('Sheet', {
      fields: (t: any) => ({
        id: t.exposeID('id'),
        count: t.exposeInt('count', { nullable: true }),
        rowsRel: t.relation('rows'),
        notes: t.relatedConnection('notes', { cursor: 'id', totalCount: true }),
        meta: t.string({
          nullable: true,
          select: ['meta'],
          resolve: (p: any) => JSON.stringify(p.meta),
        }),
        role: t.string({
          nullable: true,
          select: { role: true },
          resolve: (p: any) => p.role,
        }),
      }),
    });
    builder.queryType({
      fields: (t: any) => ({
        sheet: t.prismaField({ type: 'Sheet', resolve: () => orm.Sheet }),
      }),
    });
    return builder.toSchema();
  }

  it('does not read a relation named rows as the connection rows', async () => {
    const result = await run(
      schema(),
      '{ sheet { rowsRel { id } notes(first: 5) { edges { node { id __typename } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.sheet.notes.edges.map((edge: any) => edge.node)).toEqual([
      { id: '20', __typename: 'Note' },
      { id: '21', __typename: 'Note' },
    ]);
  });

  it('does not read a column named count as the connection total', async () => {
    const result = await run(schema(), '{ sheet { count notes(first: 1) { edges { cursor } } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.sheet.count).toBe(99);
    const total = await run(schema(), '{ sheet { count notes { totalCount } } }');
    expect(total.data.sheet.notes.totalCount).toBe(2);
  });

  it('ignores JSON column keys that look like combine slots', async () => {
    for (const query of [
      '{ sheet { meta role } }',
      '{ sheet { meta x: role } }',
      '{ sheet { role } }',
    ]) {
      const result = await run(schema(), query);
      expect(result.errors).toBeUndefined();
      expect(result.data.sheet.role ?? result.data.sheet.x).toBe('user');
    }
  });
});

describe('rows a resolver built itself', () => {
  function schema() {
    const o: any = ctx.ormClient;
    const builder = sampleBuilder({ collections: o });
    builder.prismaObject('Post', {
      fields: (t: any) => ({
        id: t.exposeID('id'),
        title: t.exposeString('title'),
        content: t.exposeString('content'),
      }),
    });
    builder.queryType({
      fields: (t: any) => ({
        stale: t.field({
          type: 'Post',
          resolve: () => ({ id: 'p-hello', title: 'kept' }),
        }),
        deleted: t.field({
          type: 'Post',
          resolve: () => ({ id: 'gone', title: 'deleted' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('keeps values the row already owns without a query', async () => {
    const result = await run(schema(), '{ stale { id title } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.stale).toEqual({ id: 'p-hello', title: 'kept' });
    expect(result.captures).toHaveLength(0);
  });

  it('still loads a column the row is missing', async () => {
    const result = await run(schema(), '{ stale { title content } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.stale.title).toBe('kept');
    expect(result.data.stale.content).toEqual(expect.any(String));
  });

  it('returns a deleted row without loading it', async () => {
    const result = await run(schema(), '{ deleted { id title } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.deleted).toEqual({ id: 'gone', title: 'deleted' });
  });
});

describe('invalid nested pages', () => {
  function schema() {
    const o: any = ctx.ormClient;
    const builder = sampleBuilder();
    builder.prismaObject('Post', { fields: (t: any) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t: any) => ({
        id: t.exposeID('id'),
        posts: t.relatedConnection('posts', { cursor: 'id', nullable: true }),
      }),
    });
    builder.queryType({
      fields: (t: any) => ({
        users: t.prismaField({ type: ['User'], resolve: () => o.User }),
      }),
    });
    return builder.toSchema();
  }

  it('only fails the connection with the bad cursor', async () => {
    const result = await run(
      schema(),
      `{ users { id posts(first: 1, after: "!!!") { edges { node { id } } } } }`,
    );
    expect(result.data.users[0].id).toEqual(expect.any(String));
    expect(result.data.users[0].posts).toBeNull();
    expect(result.errors?.[0].message).toMatch(/Invalid cursor/);
    expect(result.errors?.[0].path).toEqual(['users', 0, 'posts']);
  });

  it('rejects a null boundary on a non-null column', async () => {
    const cursor = encodeCursor(['id'], { id: null });
    const result = await run(
      schema(),
      `{ users { id posts(first: 1, after: "${cursor}") { edges { node { id } } } } }`,
    );
    expect(result.errors?.[0].message).toBe('Invalid cursor value for id.');
    expect(result.data.users[0].id).toEqual(expect.any(String));
  });
});

describe('prismaNode identity', () => {
  const node = (field: string | string[]) => {
    const builder = collisionBuilder();
    builder.queryType({});
    builder.prismaNode('Note', {
      id: { field },
      collection: () => orm.Note,
      fields: (t: any) => ({ text: t.exposeString('text', { nullable: true }) }),
    });
    return builder;
  };

  it('rejects a nullable or non-unique id field when the node is declared', () => {
    expect(() => node('text')).toThrow(/id\.field .*non-null primary or unique key/);
    expect(() => node('uniq')).toThrow(/id\.field .*non-null primary or unique key/);
    expect(() => node(['id', 'text'])).toThrow(/id\.field .*non-null/);
  });

  it('accepts a primary key', () => {
    expect(() => node('id')).not.toThrow();
  });
});

describe('to-one nullability', () => {
  it('follows the contract for the non-FK side of a 1:1', () => {
    const builder = collisionBuilder();
    builder.prismaObject('Profile', {
      fields: (t: any) => ({ id: t.exposeID('id'), owner: t.relation('owner') }),
    });
    builder.prismaObject('Owner', {
      fields: (t: any) => ({ id: t.exposeID('id'), profile: t.relation('profile') }),
    });
    builder.queryType({
      fields: (t: any) => ({
        owners: t.prismaField({ type: ['Owner'], resolve: () => orm.Owner }),
      }),
    });
    const printed = printSchema(builder.toSchema());
    expect(printed).toMatch(/type Owner \{[^}]*profile: Profile\n/);
    expect(printed).toMatch(/type Profile \{[^}]*owner: Owner!\n/);
  });

  it('returns null for an owner with no profile', async () => {
    const builder = collisionBuilder();
    builder.prismaObject('Profile', { fields: (t: any) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Owner', {
      fields: (t: any) => ({ id: t.exposeID('id'), profile: t.relation('profile') }),
    });
    builder.queryType({
      fields: (t: any) => ({
        owners: t.prismaField({
          type: ['Owner'],
          resolve: () => orm.Owner.orderBy((o: any) => o.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ owners { id profile { id } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.owners).toEqual([
      { id: '1', profile: { id: '5' } },
      { id: '2', profile: null },
    ]);
  });
});

describe('identical to-many consumers', () => {
  function schema() {
    const o: any = ctx.ormClient;
    const builder = sampleBuilder();
    builder.prismaObject('Post', {
      fields: (t: any) => ({ id: t.exposeID('id'), title: t.exposeString('title') }),
    });
    builder.prismaObject('User', {
      fields: (t: any) => ({
        id: t.exposeID('id'),
        posts: t.relation('posts', { query: () => ({ orderBy: (p: any) => p.id.asc() }) }),
        filtered: t.relation('posts', {
          args: { published: t.arg.int() },
          query: (args: any) => ({
            where: { published: args.published },
            orderBy: (p: any) => p.id.asc(),
          }),
        }),
        conn: t.relatedConnection('posts', { cursor: 'id' }),
      }),
    });
    builder.queryType({
      fields: (t: any) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => o.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  const subqueries = (sql: string) => (sql.match(/from "post"/gi) ?? []).length;

  it('reads aliases with the same query from one subquery', async () => {
    const result = await run(schema(), '{ users { a: posts { id } b: posts { title } } }');
    expect(result.errors).toBeUndefined();
    const { a, b } = result.data.users[0];
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((post: any) => Object.keys(post))).toEqual(a.map(() => ['id']));
    expect(b.map((post: any) => Object.keys(post))).toEqual(b.map(() => ['title']));
    expect(result.captures).toHaveLength(1);
    expect(subqueries(result.captures[0].sql)).toBe(1);
  });

  it('merges connection pages with equal arguments', async () => {
    const result = await run(
      schema(),
      '{ users { a: conn(first: 1) { edges { node { id } } } b: conn(first: 1) { edges { node { title } } } } }',
    );
    expect(result.errors).toBeUndefined();
    const [{ a, b }] = result.data.users;
    expect(a.edges).toHaveLength(1);
    expect(b.edges).toHaveLength(1);
    expect(subqueries(result.captures[0].sql)).toBe(1);
  });

  it('keeps consumers whose children use one alias for different fields separate', async () => {
    const o: any = ctx.ormClient;
    const builder = sampleBuilder({ collections: o });
    builder.prismaObject('Comment', { fields: (t: any) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Post', {
      fields: (t: any) => ({
        comments: t.relation('comments', { query: { orderBy: (c: any) => c.id.asc() } }),
        total: t.relationCount('comments'),
      }),
    });
    builder.prismaObject('User', {
      fields: (t: any) => ({ posts: t.relation('posts') }),
    });
    builder.queryType({
      fields: (t: any) => ({ users: t.prismaField({ type: ['User'], resolve: () => o.User }) }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { a: posts { x: comments { __typename } } b: posts { x: total } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].a[0].x).toEqual(expect.any(Array));
    expect(result.data.users[0].b[0].x).toEqual(expect.any(Number));
  });

  it('keeps different arguments separate', async () => {
    const result = await run(
      schema(),
      '{ users { a: filtered(published: 1) { id } b: filtered(published: 0) { id } } }',
    );
    expect(result.errors).toBeUndefined();
    const [{ a, b }] = result.data.users;
    expect(a.map((post: any) => post.id)).not.toEqual(b.map((post: any) => post.id));
    expect(subqueries(result.captures[0].sql)).toBe(2);
  });
});

describe('ORM callback tools', () => {
  it('passes tools to where callbacks on queries, aggregates, and connections', async () => {
    const o: any = ctx.ormClient;
    const seen: Record<string, unknown> = {};
    const record = (name: string, tools: any) => {
      seen[name] = tools?.fns;
    };
    const builder = sampleBuilder();
    builder.prismaObject('Post', { fields: (t: any) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t: any) => ({
        id: t.exposeID('id'),
        query: t.relation('posts', {
          query: {
            where: (post: any, tools: any) => {
              record('query', tools);
              return post.id.neq('x');
            },
          },
        }),
        total: t.relationCount('posts', {
          where: (post: any, _args: unknown, _ctx: unknown, tools: any) => {
            record('aggregate', tools);
            return post.id.neq('x');
          },
        }),
        conn: t.relatedConnection('posts', {
          cursor: 'id',
          where: (post: any, _args: unknown, _ctx: unknown, tools: any) => {
            record('connection', tools);
            return post.id.neq('x');
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t: any) => ({ users: t.prismaField({ type: ['User'], resolve: () => o.User }) }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { query { id } total conn(first: 1) { edges { node { id } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(seen.query).toBeDefined();
    expect(seen.aggregate).toBeDefined();
    expect(seen.connection).toBeDefined();
  });
});
