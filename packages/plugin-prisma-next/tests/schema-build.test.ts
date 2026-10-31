import { readFileSync } from 'node:fs';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { type GraphQLObjectType, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin, { type AnyContract, prismaConnectionHelpers } from '../src';
import { createBuilder, run, sampleContract, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();
const ok = (builder: ReturnType<typeof createBuilder>) =>
  builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

describe('object registration', () => {
  it('names a variant by `variant`, which wins over `name`', () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      variant: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      variant: 'V1',
      name: 'V2',
      description: 'variant one',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    ok(builder);
    const schema = builder.toSchema();
    expect(Object.keys(schema.getTypeMap())).toEqual(expect.arrayContaining(['AdminUser', 'V1']));
    expect(schema.getType('V2')).toBeUndefined();
    expect(schema.getType('V1')?.description).toBe('variant one');
  });

  it('adds string-form fields to the default type when a variant also exists', () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      name: 'AdminUser',
      fields: (t) => ({ adminField: t.exposeString('firstName') }),
    });
    builder.prismaObjectField('User', 'extra', (t) => t.exposeString('firstName'));
    ok(builder);
    const sdl = printSchema(builder.toSchema());
    expect(sdl).toMatch(/type User \{[^}]*extra: String/);
    expect(sdl).toMatch(/type AdminUser \{[^}]*adminField: String/);
  });

  it.each([
    [
      'a string-form field',
      (builder: ReturnType<typeof createBuilder>) =>
        builder.prismaObjectField('User', 'extra', (t) => t.exposeString('firstName')),
      /ObjectRef<User>/,
    ],
    [
      'a string-form prismaField',
      (builder: ReturnType<typeof createBuilder>) =>
        builder.queryField('users', (t) =>
          t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
        ),
      /ObjectRef<User>/,
    ],
    [
      'a relation',
      (builder: ReturnType<typeof createBuilder>) => {
        builder.prismaObject('Post', {
          variant: 'PostVariant',
          fields: (t) => ({ author: t.relation('author') }),
        });
      },
      /ObjectRef<User>/,
    ],
  ])('reports an unresolved default type when only a variant is registered (%s)', (_name, use, message) => {
    const builder = createBuilder();
    builder.prismaObject('User', { name: 'AdminUser', fields: (t) => ({ id: t.exposeID('id') }) });
    use(builder);
    ok(builder);
    expect(() => builder.toSchema()).toThrow(message);
  });

  it('keeps descriptions and extensions on plugin fields', () => {
    const builder = createBuilder();
    const Basic = builder.prismaObject('User', {
      variant: 'Basic',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        basic: t.variant(Basic, { extensions: { custom: 'variant' } } as never),
        title: t.string({
          nullable: true,
          description: 'first post title',
          extensions: { custom: 'select' },
          select: { posts: true },
          resolve: (user) => user.posts[0]?.title,
        }),
        posts: t.relation('posts', { description: 'posts', extensions: { custom: 'relation' } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    ok(builder);
    const fields = (builder.toSchema().getType('User') as GraphQLObjectType).getFields();
    expect(fields.basic.extensions.custom).toBe('variant');
    expect(fields.title).toMatchObject({ description: 'first post title' });
    expect(fields.title.extensions.custom).toBe('select');
    expect(fields.posts).toMatchObject({ description: 'posts' });
    expect(fields.posts.extensions.custom).toBe('relation');
  });

  it('rejects t.variant with nullable: false and isNull', () => {
    const builder = createBuilder();
    const Strict = builder.prismaObject('User', {
      variant: 'Strict',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({ strict: t.variant(Strict, { nullable: false, isNull: () => false }) }),
    });
    ok(builder);
    expect(() => builder.toSchema()).toThrow(/\bnullable: false\b/);
  });

  it('exposes scalar columns through each expose helper', async () => {
    const builder = createBuilder();
    const helpers: string[] = [];
    builder.prismaObject('Post', {
      fields: (t) => {
        helpers.push(
          typeof t.exposeBoolean,
          typeof t.exposeBooleanList,
          typeof t.exposeFloatList,
          typeof t.exposeIntList,
          typeof t.exposeIDList,
          typeof t.exposeStringList,
        );
        return {
          asId: t.exposeID('id'),
          asString: t.exposeString('title'),
          asInt: t.exposeInt('published'),
          asFloat: t.exposeFloat('score', { nullable: true }),
        };
      },
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({ type: 'Post', resolve: () => db.orm.Post.where({ id: 'p-hello' }) }),
      }),
    });
    const result = await run(builder.toSchema(), '{ post { asId asString asInt asFloat } }');
    expect(result.data.post).toEqual({
      asId: 'p-hello',
      asString: 'Hello, Pothos',
      asInt: 1,
      asFloat: 1.5,
    });
    expect(helpers).toEqual(Array(6).fill('function'));
  });

  it('brands rows and lists for a ref', () => {
    const builder = createBuilder();
    const Admin = builder.prismaObject('User', { variant: 'Admin', fields: () => ({}) });
    const Other = builder.prismaObject('User', { variant: 'Other', fields: () => ({}) });
    const row = { id: 'x' } as never;
    expect(Admin.addBrand(row)).toBe(row);
    expect([Admin.hasBrand(row), Other.hasBrand(row), Admin.hasBrand(null)]).toEqual([
      true,
      false,
      false,
    ]);
    const rows = [{ id: 'y' }, { id: 'z' }] as never[];
    expect(Other.addBrand(rows)).toBe(rows);
    expect(rows.every((value) => Other.hasBrand(value))).toBe(true);
  });
});

// For schemas that are built but never executed.
const noClient = () => ({ orm: {} });

describe('contracts', () => {
  it('rejects a contract from a non-SQL family', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: never }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: noClient, contract: { targetFamily: 'mongo' } as never },
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow(/only supports SQL contracts/);
  });

  const model = (fields: string[], relations: object = {}, table = 'table') => ({
    fields: Object.fromEntries(fields.map((field) => [field, { nullable: false }])),
    relations,
    storage: { table },
  });
  const through = {
    table: 'post_tag',
    namespaceId: '__unbound__',
    parentColumns: ['postId'],
    childColumns: ['tagId'],
    targetColumns: ['id'],
  };
  const to = (target: string) => ({ namespace: '__unbound__', model: target });

  it.each([
    [
      'an N:M relation',
      {
        Post: model(['id'], {
          tags: {
            cardinality: 'N:M',
            to: to('Tag'),
            on: { localFields: ['id'], targetFields: ['id'] },
            through,
          },
        }),
        Tag: model(['id']),
      },
      { Post: ['tags'], Tag: [] },
    ],
    [
      'an N:M relation without `on`',
      {
        Post: model(['id'], { tags: { cardinality: 'N:M', to: to('Tag'), through } }),
        Tag: model(['id']),
      },
      { Post: ['tags'], Tag: [] },
    ],
    [
      'an explicit junction model',
      {
        Post: model(['id'], {
          postTags: {
            cardinality: '1:N',
            to: to('PostTag'),
            on: { localFields: ['id'], targetFields: ['postId'] },
          },
        }),
        Tag: model(['id']),
        PostTag: model(['postId', 'tagId'], {
          tag: {
            cardinality: 'N:1',
            to: to('Tag'),
            on: { localFields: ['tagId'], targetFields: ['id'] },
          },
        }),
      },
      { Post: ['postTags'], Tag: [], PostTag: ['tag'] },
    ],
  ])('builds a schema over %s', (_name, models, relations) => {
    const contract = {
      domain: { namespaces: { __unbound__: { models } } },
    } as unknown as AnyContract;
    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: noClient, contract },
    });
    const untyped = builder as unknown as {
      prismaObject(
        name: string,
        options: {
          fields: (t: {
            relation(name: string): unknown;
            exposeID(name: string): unknown;
          }) => object;
        },
      ): void;
    };
    for (const [name, names] of Object.entries(relations)) {
      untyped.prismaObject(name, {
        fields: (t) =>
          Object.fromEntries(
            names.length
              ? names.map((relation) => [relation, t.relation(relation)])
              : [['id', t.exposeID('id')]],
          ),
      });
    }
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });
});

describe('options validated when the schema is built', () => {
  it('requires a client, and a contract beside a client function', () => {
    const define = (prismaNext: object) =>
      new SchemaBuilder<{ PrismaNextContract: typeof sampleContract }>({
        plugins: [prismaNextPlugin],
        prismaNext: prismaNext as never,
      }).prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    expect(() => define({})).toThrow(/requires prismaNext\.client/);
    expect(() => define({ client: noClient })).toThrow(/prismaNext\.contract is required/);
    expect(() => define({ client: noClient, contract: sampleContract })).not.toThrow();
  });

  it('ignores a plugin-prisma style `query` passed to prismaConnection from untyped code', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({
          type: 'User',
          cursor: 'id',
          query: () => ({ where: { id: 'u-bob' } }),
          resolve: () => db.orm.User,
        } as never),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { nodes { id } } }');
    expect(result.data.users.nodes).toEqual([{ id: 'u-alice' }, { id: 'u-bob' }]);
  });

  it('requires a cursor of distinct columns covering a non-null unique key', () => {
    const builder = createBuilder();
    expect(() => prismaConnectionHelpers(builder, 'User', { cursor: 'firstName' })).toThrow(
      /must include every field of a non-null primary or unique key.*unique tie-breaker/,
    );
    expect(() => prismaConnectionHelpers(builder, 'User', { cursor: ['id', 'id'] })).toThrow(
      /distinct columns/,
    );
    expect(() => prismaConnectionHelpers(builder, 'User', { cursor: [] as never })).toThrow(
      /cannot be empty/,
    );
    expect(() =>
      prismaConnectionHelpers(builder, 'User', { cursor: ['firstName', 'id'] }),
    ).not.toThrow();
    expect(() => prismaConnectionHelpers(builder, 'User', { cursor: 'email' })).not.toThrow();
  });

  it('does not accept a nullable unique column as the cursor key', () => {
    const contract = structuredClone(sampleContract);
    Object.assign(contract.storage.namespaces.__unbound__.entries.table.post, {
      uniques: [{ columns: ['score'] }],
    });
    const builder = new SchemaBuilder<{ PrismaNextContract: typeof contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: noClient, contract },
    });
    expect(() => prismaConnectionHelpers(builder, 'Post', { cursor: 'score' })).toThrow(
      /non-null primary or unique key/,
    );
    expect(() =>
      prismaConnectionHelpers(builder, 'Post', { cursor: ['score', 'id'] }),
    ).not.toThrow();
  });

  it('rejects a bytes cursor column', () => {
    const contract = JSON.parse(
      readFileSync(new URL('./postgres/contract.json', import.meta.url), 'utf8'),
    ) as AnyContract;
    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: noClient, contract },
    });
    expect(() =>
      prismaConnectionHelpers(builder, 'Entry' as never, { cursor: ['payload', 'id'] as never }),
    ).toThrow(/'Entry\.payload'.*bytes/);
  });
});
