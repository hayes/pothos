import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { GraphQLInt, GraphQLObjectType, printSchema } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin, {
  type AnyContract,
  applySelectionToCollection,
  getInterfaceRefFromContractModel,
  getRefFromContractModel,
} from '../src';
import { PRISMA_NEXT_MODEL, PRISMA_NEXT_PREPARED } from '../src/constants';
import {
  buildTotalCountPromise,
  wrapConnectionOptionsWithTotalCount,
} from '../src/utils/total-count';
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

describe('schema-build — N:M + duplicate-alias guards', () => {
  it.each([
    ['N:M (contract emit spelling)', 'N:M'],
  ])('builds without throwing for %s', (_label, cardinality) => {
    const stubContract = {
      domain: {
        namespaces: {
          __unbound__: {
            models: {
              Post: {
                relations: {
                  tags: {
                    cardinality,
                    to: { namespace: '__unbound__', model: 'Tag' },
                    on: { localFields: ['id'], targetFields: ['id'] },
                    through: {
                      table: 'post_tag',
                      namespaceId: '__unbound__',
                      parentColumns: ['postId'],
                      childColumns: ['tagId'],
                      targetColumns: ['id'],
                    },
                  },
                },
                fields: { id: { nullable: false } },
                storage: { table: 'post' },
              },
              Tag: {
                relations: {},
                fields: { id: { nullable: false } },
                storage: { table: 'tag' },
              },
            },
          },
        },
      },
    } as unknown as AnyContract;

    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: stubContract },
    });
    builder.prismaObject(
      'Tag' as never,
      {
        fields: (t: never) => ({ id: (t as { exposeID: (n: string) => unknown }).exposeID('id') }),
      } as never,
    );
    builder.prismaObject(
      'Post' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          tags: (t as { relation: (n: string) => unknown }).relation('tags'),
        }),
      } as never,
    );
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });

  it('the explicit-junction-model pattern (two 1:N / N:1 hops) builds cleanly', () => {
    const stubContract = {
      domain: {
        namespaces: {
          __unbound__: {
            models: {
              Post: {
                relations: {
                  postTags: {
                    cardinality: '1:N',
                    to: { namespace: '__unbound__', model: 'PostTag' },
                    on: { localFields: ['id'], targetFields: ['postId'] },
                  },
                },
                fields: { id: { nullable: false } },
                storage: { table: 'post' },
              },
              Tag: {
                relations: {
                  postTags: {
                    cardinality: '1:N',
                    to: { namespace: '__unbound__', model: 'PostTag' },
                    on: { localFields: ['id'], targetFields: ['tagId'] },
                  },
                },
                fields: { id: { nullable: false }, label: { nullable: false } },
                storage: { table: 'tag' },
              },
              PostTag: {
                relations: {
                  post: {
                    cardinality: 'N:1',
                    to: { namespace: '__unbound__', model: 'Post' },
                    on: { localFields: ['postId'], targetFields: ['id'] },
                  },
                  tag: {
                    cardinality: 'N:1',
                    to: { namespace: '__unbound__', model: 'Tag' },
                    on: { localFields: ['tagId'], targetFields: ['id'] },
                  },
                },
                fields: { postId: { nullable: false }, tagId: { nullable: false } },
                storage: { table: 'post_tag' },
              },
            },
          },
        },
      },
    } as unknown as AnyContract;

    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: stubContract },
    });
    builder.prismaObject(
      'Tag' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          label: (t as { exposeString: (n: string) => unknown }).exposeString('label'),
        }),
      } as never,
    );
    builder.prismaObject(
      'PostTag' as never,
      {
        fields: (t: never) => ({
          tag: (t as { relation: (n: string) => unknown }).relation('tag'),
        }),
      } as never,
    );
    builder.prismaObject(
      'Post' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          postTags: (t as { relation: (n: string) => unknown }).relation('postTags'),
        }),
      } as never,
    );
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });
});

describe('prismaObject — variant + extension flow', () => {
  it('prismaObject({ variant }) registers under the variant type name', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const adminRef = builder.prismaObject('User', {
      variant: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t) => ({
        admin: t.field({ type: adminRef, nullable: true, resolve: () => null }),
      }),
    });
    const sdl = printSchema(builder.toSchema());
    expect(sdl).toMatch(/type AdminUser\b/);
  });

  it('prismaObject({ variant }) wins over `name` when both are passed', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const ref = builder.prismaObject('User', {
      variant: 'V1',
      name: 'V2',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t) => ({
        x: t.field({ type: ref, nullable: true, resolve: () => null }),
      }),
    });
    const sdl = printSchema(builder.toSchema());
    expect(sdl).toMatch(/type V1\b/);
    expect(sdl).not.toMatch(/type V2\b/);
  });
});

describe('t.variant — brand wrapping invariants', () => {
  it('throws at registration when nullable: false + isNull are both passed', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const variantRef = builder.prismaObject('User', {
      variant: 'StrictVariant',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    expect(() => {
      builder.prismaObject('User', {
        fields: (t) => ({
          id: t.exposeID('id'),
          x: t.variant(variantRef, {
            nullable: false,
            isNull: () => false,
          }),
        }),
      });
      builder.toSchema();
    }).toThrow(/\bnullable: false\b/);
  });
});

describe('refs cache + connection-options short-circuit + plugin assorted', () => {
  it('wrapConnectionOptionsWithTotalCount short-circuits on ObjectRef input', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    // An existing type passed as connectionOptions must not be spread into a `{ fields }` block.
    const userConn = builder.objectRef<{ totalCount?: number }>('SharedUserConnection');
    const wrapped = wrapConnectionOptionsWithTotalCount(userConn);
    expect(wrapped).toBe(userConn);

    const opts = { description: 'plain' };
    const wrappedOpts = wrapConnectionOptionsWithTotalCount(opts);
    expect(wrappedOpts).not.toBe(opts);
    expect(typeof (wrappedOpts as { fields?: unknown }).fields).toBe('function');
  });

  it('prismaInterface honors { variant } and prismaInterfaceFields(ref) merges via the cache', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const ifaceRef = builder.prismaInterface('User', {
      variant: 'UserIface',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    // A model name would look up the default-named interface, not this variant.
    builder.prismaInterfaceFields(ifaceRef, (t) => ({
      firstName: t.exposeString('firstName'),
    }));
    const adminRef = builder.prismaObject('User', {
      name: 'AdminUser',
      interfaces: [ifaceRef],
      isTypeOf: () => true,
      fields: (t) => ({ id: t.exposeID('id'), firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        x: t.field({ type: adminRef, nullable: true, resolve: () => null }),
      }),
    });
    const sdl = printSchema(builder.toSchema());
    expect(sdl).toMatch(/interface UserIface\b/);
    expect(sdl).toMatch(/firstName: String/);
  });

  it('cached refs: getInterfaceRefFromContractModel returns same instance per builder', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const ref1 = getInterfaceRefFromContractModel('User', builder);
    const ref2 = getInterfaceRefFromContractModel('User', builder);
    expect(ref1).toBe(ref2);
  });

  it('cached refs: getRefFromContractModel returns same instance per builder', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const ref1 = getRefFromContractModel('User', builder);
    const ref2 = getRefFromContractModel('User', builder);
    expect(ref1).toBe(ref2);
  });

  it('N:M relation with no `on` block builds (localFields falls back to empty)', () => {
    const stubContract = {
      domain: {
        namespaces: {
          __unbound__: {
            models: {
              Post: {
                relations: {
                  tags: {
                    cardinality: 'N:M',
                    to: { namespace: '__unbound__', model: 'Tag' },
                    through: {
                      table: 'post_tag',
                      namespaceId: '__unbound__',
                      parentColumns: ['postId'],
                      childColumns: ['tagId'],
                      targetColumns: ['id'],
                    },
                  },
                },
                fields: { id: { nullable: false } },
                storage: { table: 'post' },
              },
              Tag: {
                relations: {},
                fields: { id: { nullable: false } },
                storage: { table: 'tag' },
              },
            },
          },
        },
      },
    } as unknown as AnyContract;
    const builder = new SchemaBuilder<{ PrismaNextContract: AnyContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: stubContract },
    });
    builder.prismaObject(
      'Tag' as never,
      {
        fields: (t: never) => ({ id: (t as { exposeID: (n: string) => unknown }).exposeID('id') }),
      } as never,
    );
    builder.prismaObject(
      'Post' as never,
      {
        fields: (t: never) => ({
          id: (t as { exposeID: (n: string) => unknown }).exposeID('id'),
          tags: (t as { relation: (n: string) => unknown }).relation('tags'),
        }),
      } as never,
    );
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });

  it('applySelectionToCollection accepts a typeName override', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.toSchema();

    const calls: string[] = [];
    const mock = {
      select: (...names: string[]) => {
        calls.push(`select:${names.join(',')}`);
        return mock;
      },
      include: () => mock,
      where: () => mock,
      orderBy: () => mock,
      limit: () => mock,
      offset: () => mock,
      count: () => ({}),
      combine: () => mock,
    };

    const schema = builder.toSchema();
    const info = {
      parentType: schema.getType('User'),
      path: { prev: undefined, key: 'whatever', typename: 'Query' },
      fieldNodes: [
        {
          kind: 'Field',
          name: { kind: 'Name', value: 'whatever' },
          selectionSet: {
            kind: 'SelectionSet',
            selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
          },
        },
      ],
      returnType: { name: 'Unrelated' },
      fragments: {},
      variableValues: {},
      schema,
    } as never;

    applySelectionToCollection(
      mock as never,
      info,
      ctx.contract as never,
      {},
      {
        typeName: 'User',
      },
    );
    expect(calls.some((c) => c === 'select:id')).toBe(true);
  });

  it('totalCountSeq per-builder: independent counter per builder', () => {
    const make = () => {
      const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
        plugins: [prismaNextPlugin, RelayPlugin],
        prismaNext: { contract: ctx.contract },
      });
      b.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      b.prismaObject('User', {
        fields: (t) => ({
          id: t.exposeID('id'),
          postsConnection: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
        }),
      });
      return b.toSchema();
    };
    const schema1 = make();
    const schema2 = make();
    expect(schema1).toBeDefined();
    expect(schema2).toBeDefined();
  });
});

describe('PreparedFieldExtension — round-trip shape', () => {
  it('t.prismaField registers { modelName, typeName } with both equal for non-variant types', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (() => ctx.ormClient.User) as never,
        }),
      }),
    });
    const schema = builder.toSchema();
    const queryFields = (schema.getType('Query') as GraphQLObjectType).getFields();
    const ext = queryFields.users!.extensions as Record<string | symbol, unknown>;
    const prepared = ext[PRISMA_NEXT_PREPARED] as { modelName: string; typeName: string };
    expect(prepared).toMatchObject({ modelName: 'User', typeName: 'User' });
  });

  it('records typeName from a variant prismaObject', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const adminRef = builder.prismaObject('User', {
      name: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t) => ({
        admin: t.prismaField({
          type: adminRef,
          nullable: true,
          resolve: (() => ctx.ormClient.User) as never,
        }),
      }),
    });
    const schema = builder.toSchema();
    const queryFields = (schema.getType('Query') as GraphQLObjectType).getFields();
    const ext = queryFields.admin!.extensions as Record<string | symbol, unknown>;
    const prepared = ext[PRISMA_NEXT_PREPARED] as { modelName: string; typeName: string };
    expect(prepared.modelName).toBe('User');
    expect(prepared.typeName).toBe('AdminUser');
  });
});

describe('variant-only registration — Pothos surfaces unresolved-ref', () => {
  it('prismaObjectField string form surfaces unresolved ref when only a variant is registered', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', {
      name: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObjectField('User', 'extra', (t) => t.exposeString('firstName'));
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).toThrow(/ObjectRef<User>/);
  });
});

describe('prismaInterface → prismaObject model propagation', () => {
  it('throws when a prismaObject implements a prismaInterface bound to a different model', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const postIface = builder.prismaInterface('Post', {
      variant: 'PostLike',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      interfaces: [postIface as never],
      isTypeOf: () => true,
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t) => ({
        n: t.int({ nullable: true, resolve: () => null }),
      }),
    });
    expect(() => builder.toSchema()).toThrow(
      /PrismaObjects must share a contract model with the PrismaInterfaces they extend/,
    );
  });
});

describe('prismaNode — user isTypeOf is preserved', () => {
  it('honors a user-supplied isTypeOf', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin, RelayPlugin],
      relay: { clientMutationId: 'omit', cursorType: 'String' },
      prismaNext: { contract: ctx.contract },
    } as never);
    let calledWith: unknown = null;
    builder.prismaNode('User', {
      id: { field: 'id' },
      collection: ctx.ormClient.User,
      isTypeOf: (value: unknown) => {
        calledWith = value;
        return (value as { isUser?: boolean })?.isUser === true;
      },
      fields: (t) => ({ name: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        n: t.int({ nullable: true, resolve: () => null }),
      }),
    });
    const schema = builder.toSchema();
    const userType = schema.getType('User') as GraphQLObjectType;
    const isTypeOf = userType.isTypeOf!;
    expect(isTypeOf({ isUser: true }, {} as never, {} as never)).toBe(true);
    expect(calledWith).toEqual({ isUser: true });
    expect(isTypeOf({}, {} as never, {} as never)).toBe(false);
  });

  it('preserves async user isTypeOf', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin, RelayPlugin],
      relay: { clientMutationId: 'omit', cursorType: 'String' },
      prismaNext: { contract: ctx.contract },
    } as never);
    builder.prismaNode('User', {
      id: { field: 'id' },
      collection: ctx.ormClient.User,
      isTypeOf: async () => false,
      fields: (t) => ({ name: t.exposeString('firstName') }),
    });
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    const schema = builder.toSchema();
    const userType = schema.getType('User') as GraphQLObjectType;
    const isTypeOf = userType.isTypeOf!;
    const result = isTypeOf({}, {} as never, {} as never);
    expect(typeof (result as { then?: unknown })?.then).toBe('function');
    expect(await result).toBe(false);
  });
});

describe('t.variant — extensions preservation (drizzle parity)', () => {
  it('user-passed extensions land on the field config alongside the plugin extension', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const userBasic = builder.prismaObject('User', {
      name: 'UserBasic',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        basic: t.variant(userBasic, {
          extensions: { customMeta: 'preserved' },
        } as never),
      }),
    });
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    const schema = builder.toSchema();
    const userType = schema.getType('User') as GraphQLObjectType;
    const ext = userType.getFields().basic!.extensions as Record<string, unknown>;
    expect(ext.customMeta).toBe('preserved');
  });
});

describe('buildTotalCountPromise — direct unit', () => {
  // `selectedFieldNames` reads the field's return type to see the selection through any
  // wrapper on it, so the fake info carries a connection-shaped return type.
  const connectionType = new GraphQLObjectType({
    name: 'FakeConnection',
    fields: { edges: { type: GraphQLInt }, totalCount: { type: GraphQLInt } },
  });

  it('returns resolved-undefined when totalCount is not selected', async () => {
    const info = {
      returnType: connectionType,
      fieldNodes: [
        {
          selectionSet: {
            selections: [{ kind: 'Field', name: { value: 'edges' } }],
          },
        },
      ],
      fragments: {},
      variableValues: {},
    } as never;
    const promise = buildTotalCountPromise({
      info,
      enabled: true,
      resolver: undefined,
      baseCollection: null,
      parent: null,
      args: null,
      context: {},
    });
    expect(await promise).toBeUndefined();
  });

  it('runs the user-supplied resolver when totalCount is selected', async () => {
    const info = {
      returnType: connectionType,
      fieldNodes: [
        {
          selectionSet: {
            selections: [{ kind: 'Field', name: { value: 'totalCount' } }],
          },
        },
      ],
      fragments: {},
      variableValues: {},
    } as never;
    const promise = buildTotalCountPromise({
      info,
      enabled: true,
      resolver: () => 42,
      baseCollection: null,
      parent: null,
      args: null,
      context: {},
    });
    expect(await promise).toBe(42);
  });

  it('synchronously-throwing user resolver yields a rejected promise (no escape)', async () => {
    const info = {
      returnType: connectionType,
      fieldNodes: [
        {
          selectionSet: {
            selections: [{ kind: 'Field', name: { value: 'totalCount' } }],
          },
        },
      ],
      fragments: {},
      variableValues: {},
    } as never;
    const boom = () => {
      throw new Error('boom');
    };
    const promise = buildTotalCountPromise({
      info,
      enabled: true,
      resolver: boom,
      baseCollection: null,
      parent: null,
      args: null,
      context: {},
    });
    await expect(promise).rejects.toThrow(/boom/);
  });

  it('falls back to baseCollection.aggregate when no resolver is supplied', async () => {
    const info = {
      returnType: connectionType,
      fieldNodes: [
        {
          selectionSet: {
            selections: [{ kind: 'Field', name: { value: 'totalCount' } }],
          },
        },
      ],
      fragments: {},
      variableValues: {},
    } as never;
    const baseCollection = {
      aggregate: (fn: (a: { count: () => unknown }) => unknown) => {
        const spec = fn({ count: () => 'count-marker' });
        expect(spec).toEqual({ total: 'count-marker' });
        return Promise.resolve({ total: 99 });
      },
    };
    const promise = buildTotalCountPromise({
      info,
      enabled: true,
      resolver: undefined,
      baseCollection,
      parent: null,
      args: null,
      context: {},
    });
    expect(await promise).toBe(99);
  });
});

describe('onTypeConfig — model inherited from prismaInterface onto plain objectType', () => {
  it('a plain objectType implementing a prismaInterface picks up the interface model', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    const ifaceRef = builder.prismaInterface('User', {
      variant: 'UserBase',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    const plainRef = builder.objectRef<{ id: string }>('PlainUser');
    builder.objectType(plainRef, {
      interfaces: [ifaceRef as never],
      isTypeOf: () => true,
      fields: (t) => ({ id: t.id({ resolve: (row) => row.id }) }),
    });
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    const schema = builder.toSchema();
    const plain = schema.getType('PlainUser') as GraphQLObjectType;
    expect((plain.extensions as Record<string | symbol, unknown>)[PRISMA_NEXT_MODEL]).toBe('User');
  });
});

describe('variant-only — string-form refs surface as unresolved-ref via Pothos core', () => {
  it('t.prismaField({ type: "User" }) surfaces unresolved ref when only a variant is registered', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', {
      name: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (() => ctx.ormClient.User) as never,
        }),
      }),
    });
    expect(() => builder.toSchema()).toThrow(/ObjectRef<User>/);
  });
});

describe('variant-only registration — legitimate both-default-and-variant SDL', () => {
  it('default + variant + string-form field on default produces both types', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      name: 'AdminUser',
      fields: (t) => ({
        id: t.exposeID('id'),
        adminField: t.exposeString('firstName'),
      }),
    });
    builder.prismaObjectField('User', 'extra', (t) => t.exposeString('firstName'));
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    const sdl = printSchema(builder.toSchema());
    expect(sdl).toMatch(/type User\b[^{}]*\{[^}]*extra: String/);
    expect(sdl).toMatch(/type AdminUser\b[^{}]*\{[^}]*adminField: String/);
  });
});

describe('cursor accessor on connection edges', () => {
  it('cursor is non-enumerable so JSON.stringify does not force encoding', async () => {
    const { buildConnectionPage, buildPaginationParams } = await import('../src/utils/cursors');
    let encodeCalls = 0;
    const pagination = {
      ...buildPaginationParams('id', { first: 3 }),
      encodeRowCursor: (row: Record<string, unknown>) => {
        encodeCalls += 1;
        return `cursor:${String(row.id)}`;
      },
    };
    const page = buildConnectionPage([{ id: 1 }, { id: 2 }, { id: 3 }], pagination);
    expect(encodeCalls).toBe(2);
    const before = encodeCalls;
    JSON.stringify(page);
    expect(encodeCalls).toBe(before);
    expect(page.edges[1]!.cursor).toBe('cursor:2');
    expect(encodeCalls).toBe(before + 1);
    expect(page.edges[1]!.cursor).toBe('cursor:2');
    expect(encodeCalls).toBe(before + 1);
  });

  it('Object.assign({}, edge) drops the cursor (documented invariant of enumerable:false)', async () => {
    const { buildConnectionPage, buildPaginationParams } = await import('../src/utils/cursors');
    const pagination = {
      ...buildPaginationParams('id', { first: 2 }),
      encodeRowCursor: (row: Record<string, unknown>) => `cursor:${String(row.id)}`,
    };
    const page = buildConnectionPage([{ id: 1 }, { id: 2 }], pagination);
    const copy = Object.assign({}, page.edges[0]) as { cursor?: string; node?: unknown };
    expect(copy.node).toEqual({ id: 1 });
    expect(copy.cursor).toBeUndefined();
  });
});

describe('variant-only related model — surfaces as unresolved-ref via Pothos core', () => {
  it('t.relation surfaces unresolved-ref when the related model is registered only as a variant', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    // `t.relation('posts')` resolves to the default Post ref, which is never registered.
    builder.prismaObject('Post', {
      name: 'PostVariant',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        posts: t.relation('posts'),
      }),
    });
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).toThrow(/ObjectRef<Post>/);
  });
});

describe('t.prismaConnection({ query }) sentinel — JS runtime strip', () => {
  it('a JS caller bypassing types with `query` set does not crash; schema builds', async () => {
    const RelayPlugin = (await import('@pothos/plugin-relay')).default;
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin, RelayPlugin],
      relay: { clientMutationId: 'omit', cursorType: 'String' },
      prismaNext: { contract: ctx.contract },
    } as never);
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({
          type: 'User',
          cursor: 'id',
          query: () => ({ where: { id: 1 } }),
          resolve: () => ctx.ormClient.User as never,
        } as never),
      }),
    });
    expect(builder.toSchema()).toBeDefined();
  });
});
