import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse, printSchema } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
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

function createBuilder() {
  return new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract },
  });
}

async function run(
  schema: ReturnType<ReturnType<typeof createBuilder>['toSchema']>,
  query: string,
) {
  const result = await execute({ schema, document: parse(query), contextValue: {} });
  expect(result.errors).toBeUndefined();
  return result.data as Record<string, never>;
}

describe('partial parent rows', () => {
  it('loads the columns a type declares for a totalCount callback', async () => {
    const seen: unknown[] = [];
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      select: ['email'],
      fields: (t) => ({
        firstName: t.exposeString('firstName'),
        posts: t.relatedConnection('posts', {
          cursor: 'id',
          totalCount: (user) => {
            seen.push(user.email);
            return 7;
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => ctx.ormClient.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const data = await run(builder.toSchema(), '{ users { firstName posts { totalCount } } }');
    expect(data).toEqual({ users: [{ firstName: 'Alice', posts: { totalCount: 7 } }] });
    expect(seen).toEqual(['alice@example.com']);
  });

  it('forces a variant select into the row for isNull, whatever the query selects', async () => {
    const builder = createBuilder();
    const adminRef = builder.prismaObject('User', {
      variant: 'AdminUser',
      fields: (t) => ({ lastName: t.exposeString('lastName') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        admin: t.variant(adminRef, {
          select: ['firstName'],
          isNull: (user) => user.firstName !== 'Alice',
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => ctx.ormClient.User.orderBy((u) => u.id.asc()),
        }),
      }),
    });
    const data = await run(builder.toSchema(), '{ users { id admin { lastName } } }');
    expect(data).toEqual({
      users: [
        { id: 'u-alice', admin: { lastName: 'Andrews' } },
        { id: 'u-bob', admin: null },
      ],
    });
  });
});

describe('interface return types', () => {
  function interfaceSchema() {
    const builder = createBuilder();
    const iface = builder.prismaInterface('User', {
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaInterfaceField(iface, 'firstName', (t) => t.exposeString('firstName'));
    builder.prismaObject('User', {
      variant: 'AnyUser',
      interfaces: [iface],
      isTypeOf: () => true,
      fields: (t) => ({
        posts: t.relation('posts', { query: { orderBy: (p) => p.id.asc() } }),
      }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        // A bare relation to a model that is only registered as an interface.
        author: t.relation('author'),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [iface],
          resolve: () => ctx.ormClient.User.orderBy((u) => u.id.asc()),
        }),
        user: t.prismaField({
          type: iface,
          nullable: true,
          resolve: () => ctx.ormClient.User.where({ id: 'u-bob' }),
        }),
        userConnection: t.prismaConnection({
          type: iface,
          cursor: 'id',
          resolve: () => ctx.ormClient.User,
        }),
        post: t.prismaField({
          type: 'Post',
          resolve: () => ctx.ormClient.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('plans fields selected through an interface root', async () => {
    const data = await run(
      interfaceSchema(),
      `{
        users { __typename id firstName ... on AnyUser { posts { id } } }
        user { firstName }
      }`,
    );
    expect(data.user).toEqual({ firstName: 'Bob' });
    expect((data.users as { posts: { id: string }[] }[])[0]).toMatchObject({
      __typename: 'AnyUser',
      id: 'u-alice',
      firstName: 'Alice',
    });
    expect((data.users as { posts: unknown[] }[])[0].posts.length).toBeGreaterThan(0);
  });

  it('plans a connection of an interface', async () => {
    const data = await run(
      interfaceSchema(),
      '{ userConnection(first: 1) { edges { node { firstName ... on AnyUser { posts { id } } } } } }',
    );
    const [edge] = (
      data.userConnection as {
        edges: { node: { firstName: string; posts: unknown[] } }[];
      }
    ).edges;
    expect(edge.node.firstName).toBe('Alice');
    expect(edge.node.posts.length).toBeGreaterThan(0);
  });

  it('resolves a bare relation to the interface ref', async () => {
    const data = await run(interfaceSchema(), '{ post { author { firstName } } }');
    expect(data).toEqual({ post: { author: { firstName: 'Alice' } } });
    expect(printSchema(interfaceSchema())).toMatch(/author: User!/);
  });
});

describe('nullable connections', () => {
  it('passes a null resolver result through', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaConnection({
          type: 'Post',
          cursor: 'id',
          nullable: true,
          totalCount: true,
          resolve: () => null,
        }),
      }),
    });
    const data = await run(builder.toSchema(), '{ posts { totalCount edges { node { id } } } }');
    expect(data).toEqual({ posts: null });
  });
});

describe('bytes cursors', () => {
  const contract = JSON.parse(
    readFileSync(fileURLToPath(new URL('./postgres/contract.json', import.meta.url)), 'utf8'),
  );

  it('rejects a bytes cursor column when the schema is built', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: never }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { contract },
    } as never) as never as {
      prismaObject: (name: string, options: unknown) => void;
      queryType: (options: unknown) => void;
      toSchema: () => unknown;
    };
    builder.prismaObject('Entry', {
      fields: (t: { exposeID: (name: string) => unknown }) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t: { prismaConnection: (options: unknown) => unknown }) => ({
        entries: t.prismaConnection({
          type: 'Entry',
          cursor: ['payload', 'id'],
          resolve: () => null,
        }),
      }),
    });
    expect(() => builder.toSchema()).toThrow(/'Entry\.payload'.*bytes/);
  });
});

describe('public helpers', () => {
  it('adds and checks a type brand on rows and lists', () => {
    const builder = createBuilder();
    const admin = builder.prismaObject('User', {
      variant: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    const other = builder.prismaObject('User', {
      variant: 'OtherUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    const row = { id: 'x' } as never;
    expect(admin.addBrand(row)).toBe(row);
    expect(admin.hasBrand(row)).toBe(true);
    expect(other.hasBrand(row)).toBe(false);
    expect(admin.hasBrand(null)).toBe(false);
    expect(admin.hasBrand('x')).toBe(false);
    const rows = [{ id: 'y' }, { id: 'z' }] as never[];
    expect(other.addBrand(rows)).toBe(rows);
    expect(rows.every((value) => other.hasBrand(value))).toBe(true);
  });

  it('exposes scalars through each helper', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', {
      fields: (t) => ({
        asId: t.exposeID('id'),
        asString: t.exposeString('title'),
        asInt: t.exposeInt('published'),
        asFloat: t.exposeFloat('score', { nullable: true }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({
          type: 'Post',
          resolve: () => ctx.ormClient.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    const data = await run(builder.toSchema(), '{ post { asId asString asInt asFloat } }');
    expect(data).toEqual({
      post: { asId: 'p-hello', asString: 'Hello, Pothos', asInt: 1, asFloat: 1.5 },
    });
  });

  it('declares the list and boolean expose helpers', () => {
    const builder = createBuilder();
    const names: string[] = [];
    builder.prismaObject('Post', {
      fields: (t) => {
        for (const helper of [
          t.exposeBoolean,
          t.exposeBooleanList,
          t.exposeFloatList,
          t.exposeIntList,
          t.exposeIDList,
          t.exposeStringList,
        ]) {
          names.push(typeof helper);
        }
        return { id: t.exposeID('id') };
      },
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    builder.toSchema();
    expect(names).toEqual(Array(6).fill('function'));
  });
});
