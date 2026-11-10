import SchemaBuilder, { PothosSchemaError } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import postgres from '@prisma/orm-postgres/runtime';
import { type GraphQLObjectType, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import PrismaNextPlugin, { type AnyContract, prismaConnectionHelpers } from '../src';
import {
  buildOnlyContext,
  createBuilder,
  loadPostgresContract,
  postgresUrl,
  run,
  sampleContract,
  useSampleDb,
} from './fixtures/helpers';
import { junctionContract } from './fixtures/junction';
import type { Contract as PostgresContract } from './postgres/contract';

const db = useSampleDb();
const ok = (builder: ReturnType<typeof createBuilder>) =>
  builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

describe('object registration', () => {
  it('renames the default type with `name`, which model keys then refer to', async () => {
    const builder = createBuilder();
    const AuthUser = builder.prismaObject('User', {
      name: 'AuthUser',
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({ title: t.exposeString('title'), author: t.relation('author') }),
    });
    builder.prismaObjectField('User', 'extra', (t) => t.exposeString('lastName'));
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.where({ id: 'u-bob' }),
        }),
        posts: t.prismaField({
          type: ['Post'],
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    const schema = builder.toSchema();
    expect(schema.getType('User')).toBeUndefined();
    expect(AuthUser.name).toBe('AuthUser');
    const result = await run(
      schema,
      '{ users { __typename firstName extra } posts { author { __typename firstName } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [{ __typename: 'AuthUser', firstName: 'Bob', extra: 'Brown' }],
      posts: [{ author: { __typename: 'AuthUser', firstName: 'Alice' } }],
    });
  });

  it.each([
    ['without options', {}],
    ['with a name', { name: 'Renamed' }],
  ])('rejects a second registration of the default type (%s)', (_label, second) => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    expect(() =>
      builder.prismaObject('User', {
        ...second,
        fields: (t) => ({ email: t.exposeString('email') }),
      }),
    ).toThrow(
      new PothosSchemaError(
        "Model 'User' already has a type registered without a 'variant'. Give one of them a 'variant', or add fields with prismaObjectField(s).",
      ),
    );
  });

  it('rejects a prismaNode beside a default type of the same model', () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    expect(() => builder.prismaNode('User', { id: { field: 'id' }, fields: () => ({}) })).toThrow(
      /Model 'User' already has a type registered without a 'variant'/,
    );
  });

  it('names a variant by `variant`', () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      variant: 'AdminUser',
      description: 'an admin',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    ok(builder);
    const schema = builder.toSchema();
    expect(schema.getType('AdminUser')?.description).toBe('an admin');
  });

  it('adds string-form fields to the default type when a variant also exists', () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      variant: 'AdminUser',
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
          t.prismaField({ type: ['User'], collection: () => db.orm.User }),
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
    builder.prismaObject('User', {
      variant: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    use(builder);
    ok(builder);
    expect(() => builder.toSchema()).toThrow(message);
  });

  it('rejects a model registered as both an object and an interface under its default name', () => {
    const message = /its default type would be both an object and an interface/;
    const objectFirst = createBuilder();
    objectFirst.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    expect(() =>
      objectFirst.prismaInterface('User', { fields: (t) => ({ id: t.exposeID('id') }) }),
    ).toThrow(message);
    const interfaceFirst = createBuilder();
    interfaceFirst.prismaInterface('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    expect(() =>
      interfaceFirst.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) }),
    ).toThrow(message);
  });

  it('keeps descriptions and extensions on plugin fields', () => {
    const builder = createBuilder();
    const Basic = builder.prismaObject('User', {
      variant: 'Basic',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        basic: t.variant(Basic, { extensions: { custom: 'variant' } }),
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
        post: t.prismaField({
          type: 'Post',
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
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
  const model = (fields: string[], relations: object = {}, table = 'table') => ({
    fields: Object.fromEntries(fields.map((field) => [field, { nullable: false }])),
    relations,
    storage: { table },
  });
  const junction = (
    junctionContract.domain.namespaces as unknown as Record<
      string,
      { models: Record<string, { relations: Record<string, object> }> }
    >
  ).__unbound__.models;
  const { on: _on, ...tagsWithoutOn } = junction.Post.relations.tags as { on: unknown };
  const to = (target: string) => ({ namespace: '__unbound__', model: target });

  it.each([
    [
      'an N:M relation without `on`',
      { ...junction, Post: { ...junction.Post, relations: { tags: tagsWithoutOn } } },
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
    const builder = new SchemaBuilder<{ PrismaContract: AnyContract }>({
      plugins: [PrismaNextPlugin],
      prisma: { client: noClient, context: buildOnlyContext(contract) },
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
  it('rejects an orderBy column that is not a field, and a model without a key', () => {
    const builder = createBuilder();
    expect(() =>
      prismaConnectionHelpers(builder, 'User', { query: { orderBy: { nope: 'asc' } as never } }),
    ).toThrow("Invalid orderBy: 'User.nope' is not a field of the model.");
    expect(() =>
      prismaConnectionHelpers(builder, 'User', { query: { orderBy: { firstName: 'asc' } } }),
    ).not.toThrow();
    expect(() => prismaConnectionHelpers(builder, 'PostView', {})).toThrow(
      /'PostView' need a non-null primary or unique key/,
    );
  });

  it('does not page by a nullable unique column', () => {
    const contract = structuredClone(sampleContract);
    Object.assign(contract.storage.namespaces.__unbound__.entries.table.post, {
      primaryKey: undefined,
      uniques: [{ columns: ['score'] }],
    });
    const builder = new SchemaBuilder<{ PrismaContract: typeof contract }>({
      plugins: [RelayPlugin, PrismaNextPlugin],
      relay: {},
      prisma: { client: noClient, context: buildOnlyContext(contract) },
    });
    expect(() =>
      prismaConnectionHelpers(builder, 'Post', { query: { orderBy: { score: 'asc' } } }),
    ).toThrow(/non-null primary or unique key/);
  });

  // Postgres `DateTime` is `timestamptz(3)`, which a JavaScript Date holds exactly. A bare MySQL
  // `datetime` has whole seconds.
  it.each([
    ['pg/timestamptz-date@1', undefined, true],
    ['pg/timestamptz-date@1', 6, true],
    ['pg/timestamptz-date@1', 3, false],
    ['mysql/datetime@1', undefined, false],
    ['mysql/datetime@1', 3, false],
    ['mysql/datetime@1', 6, true],
  ])('pages and identifies by %s of precision %s only when a Date holds it: rejected %s', (codecId, precision, rejected) => {
    const contract = structuredClone(sampleContract);
    Object.assign(contract.domain.namespaces.__unbound__.models.Post.fields.createdAt, {
      type: {
        codecId,
        kind: 'scalar',
        ...(precision === undefined ? {} : { typeParams: { precision } }),
      },
    });
    const builder = new SchemaBuilder<{ PrismaContract: typeof contract }>({
      plugins: [RelayPlugin, PrismaNextPlugin],
      relay: {},
      prisma: { client: noClient, context: buildOnlyContext(contract) },
    });
    const page = () =>
      prismaConnectionHelpers(builder, 'Post', { query: { orderBy: { createdAt: 'asc' } } });
    const node = () =>
      builder.prismaNode('Post', {
        id: { field: ['createdAt', 'id'] },
        fields: (t) => ({ title: t.exposeString('title') }),
      });
    if (rejected) {
      expect(page).toThrow(/'Post\.createdAt' .*TimestamptzTemporal/);
      expect(node).toThrow(/prismaNode 'Post' can't use this id\.field: .*TimestamptzTemporal/);
    } else {
      expect(page).not.toThrow();
      expect(node).not.toThrow();
    }
  });

  it('rejects a cursor column whose codec the ORM cannot order', () => {
    // The client connects on its first query, so building needs no database.
    const { context } = postgres({
      contract: loadPostgresContract<PostgresContract>(
        new URL('./postgres/contract.json', import.meta.url),
      ),
      url: postgresUrl,
    });
    const builder = new SchemaBuilder<{ PrismaContract: PostgresContract }>({
      plugins: [RelayPlugin, PrismaNextPlugin],
      relay: {},
      prisma: { client: noClient, context },
    });
    expect(() =>
      prismaConnectionHelpers(builder, 'Entry', {
        query: { orderBy: { payload: 'asc' } as never },
      }),
    ).toThrow("Invalid orderBy: 'Entry.payload' has a codec the ORM can't order by.");
    expect(() =>
      prismaConnectionHelpers(builder, 'Entry', { query: { orderBy: { id: 'asc' } } }),
    ).not.toThrow();
  });
});
