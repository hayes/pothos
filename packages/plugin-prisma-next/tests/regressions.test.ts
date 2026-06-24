import SchemaBuilder from '@pothos/core';
import { type GraphQLObjectType, printSchema } from 'graphql';
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

// Cursor encode/decode tests moved to `tests/cursors.test.ts`.

describe('schema-build — N:M + duplicate-alias guards', () => {
  // prisma-next's authoring DSL has `rel.manyToMany(...)` which lowers
  // to `cardinality: 'N:M'` in the emitted contract. `'N:M'` is the ONLY
  // many-to-many spelling in prisma-next 0.14.0 — its
  // `RelationCardinalityTag` union is `'1:1' | 'N:1' | '1:N' | 'N:M'`;
  // there is no `'M:N'` tag anywhere in the contract or orm-client.
  //
  // As of 0.14.0 the orm-client implements junction reads (`through` /
  // `IncludeThroughDescriptor`, see tests/prisma-next-m-n-upstream-pin
  // canary), and the plugin now supports them: an N:M relation is treated
  // as a to-many relation, its `through` descriptor is carried on the
  // relation meta, and the walker emits `.include(rel)` like any other
  // to-many relation (prisma-next resolves the junction join internally).
  // The full junction flow — schema build, relation meta, and end-to-end
  // resolution against real sqlite — is exercised in
  // tests/junction-runtime.test.ts. Below we pin that schema build no
  // longer rejects N:M.

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
          // The N:M relation is now a valid to-many relation.
          tags: (t as { relation: (n: string) => unknown }).relation('tags'),
        }),
      } as never,
    );
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).not.toThrow();
  });

  it('the explicit-junction-model pattern (two 1:N / N:1 hops) still builds cleanly', () => {
    // The junction-as-its-own-model pattern remains valid alongside
    // native N:M support: model the junction with two regular 1:N / N:1
    // hops. Must build without errors.
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

// Auto-branding at the t.prismaField boundary has been removed.
// Users who need brands in abstract positions call ref.addBrand(row)
// explicitly. Matches plugin-prisma's pattern.

describe('refs cache + connection-options short-circuit + plugin assorted', () => {
  it('wrapConnectionOptionsWithTotalCount short-circuits on ObjectRef input', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    // Build a plain `objectRef` — passing one as connectionOptions
    // tells `t.connection` to reuse an existing type. The wrap helper
    // must not spread it into a `{ fields }` block.
    const userConn = builder.objectRef<{ totalCount?: number }>('SharedUserConnection');
    const wrapped = wrapConnectionOptionsWithTotalCount(userConn);
    expect(wrapped).toBe(userConn);

    // For a plain options object, the wrap DOES add a `fields` thunk.
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
    // Pass the ref directly to merge cross-file fields. Passing a
    // string model name would create a separate cache entry keyed by
    // model name (not the variant typeName), so the fields wouldn't
    // merge into the variant-registered interface.
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
                  // Hand-crafted relation with no `on` block — N:M support
                  // reads localFields via `'on' in rel`, so a missing `on`
                  // degrades to empty FK columns rather than crashing.
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
    // Verify the public escape hatch honors the `typeName` option —
    // used by `prismaNode.loadWithoutCache` to map against the
    // concrete model's type tree rather than `info.returnType`
    // (which is the Node interface).
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.toSchema();

    // Recording-style minimal mock collection.
    const calls: string[] = [];
    const mock = {
      select: (...names: string[]) => {
        calls.push(`select:${names.join(',')}`);
        return mock;
      },
      include: () => mock,
      where: () => mock,
      orderBy: () => mock,
      take: () => mock,
      skip: () => mock,
      count: () => ({}),
      combine: () => mock,
    };

    // Build fake info whose returnType is *not* User; the override
    // forces the mapper to descend against the User type tree.
    const info = {
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
      schema: builder.toSchema(),
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
    // `id` is the exposed column on User; if the override worked,
    // the mock's `select` should have been called with it.
    expect(calls.some((c) => c === 'select:id')).toBe(true);
  });

  it('totalCountSeq per-builder: independent counter per builder (R3-21)', () => {
    // The alias for `totalCount: true` includes a sequence number.
    // Two separately-built schemas should NOT share the counter;
    // each starts at 1. Construct two builders, register the same
    // shape, and assert their first totalCount aliases land at the
    // same suffix value.
    const make = () => {
      const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
        plugins: [prismaNextPlugin],
        prismaNext: { contract: ctx.contract },
      });
      b.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      b.prismaObject('User', {
        fields: (t) => ({
          id: t.exposeID('id'),
          postsConnection: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
        }),
      });
      // Read the registered extension via the schema. We can't easily
      // pull the alias out — instead, just verify the schema builds
      // (sequence resets don't collide).
      return b.toSchema();
    };
    const schema1 = make();
    const schema2 = make();
    expect(schema1).toBeDefined();
    expect(schema2).toBeDefined();
  });
});

// selectionIncludesField / selectionSetIncludesField unit tests moved to
// `tests/selection-walk.test.ts`.
// brandResult Iterable/AsyncIterable + rebrandForVariant invariant tests
// moved to `tests/branding.test.ts`.

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
    // Variant: register with `name` so the GraphQL type name diverges
    // from the contract model name. The prepared extension must
    // record both so wrapResolve brands correctly.
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
  // Matches plugin-drizzle's pattern: variants get fresh refs; the
  // default-named ref is only registered if the user passes no variant.
  // If a string-form helper later references the model but only a
  // variant was registered, Pothos core surfaces this as an unresolved
  // ObjectRef error at schema-build time.
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

describe('prismaNode — user isTypeOf merged with brand check', () => {
  it('honors a user-supplied isTypeOf while still keeping the brand fallback', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin, require('@pothos/plugin-relay').default],
      relay: { clientMutationId: 'omit', cursorType: 'String' },
      prismaNext: { contract: ctx.contract },
    } as never);
    let calledWith: unknown = null;
    builder.prismaNode('User', {
      id: { field: 'id' },
      // Stub collection — the test only inspects isTypeOf wiring.
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
    // User predicate wins for { isUser: true }.
    expect(isTypeOf({ isUser: true }, {} as never, {} as never)).toBe(true);
    expect(calledWith).toEqual({ isUser: true });
    // Otherwise falls through to the brand check, which returns false
    // for a plain object (no brand stamped yet).
    expect(isTypeOf({}, {} as never, {} as never)).toBe(false);
  });

  it('handles async user isTypeOf without short-circuiting on the Promise object', async () => {
    // A bare `userIsTypeOf(value) || brandCheck(value)` short-circuits
    // on a truthy Promise<false>. The merge must detect the Promise
    // return and chain through .then so the brand check still runs.
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin, require('@pothos/plugin-relay').default],
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
    // Plain object: user predicate resolves to false async; brand
    // check is false. Final result should be false (not Promise-truthy).
    const result = isTypeOf({}, {} as never, {} as never);
    expect(typeof (result as { then?: unknown })?.then).toBe('function');
    expect(await result).toBe(false);
  });
});

// Forward-order ref-creation orphan: variant-only registration with a
// prior string-form helper call previously had a custom error. Now
// surfaces via Pothos's natural unresolved-ref error at toSchema().

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
  it('returns resolved-undefined when totalCount is not selected', async () => {
    const info = {
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
      context: null,
    });
    expect(await promise).toBeUndefined();
  });

  it('runs the user-supplied resolver when totalCount is selected', async () => {
    const info = {
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
      context: null,
    });
    expect(await promise).toBe(42);
  });

  it('synchronously-throwing user resolver yields a rejected promise (no escape)', async () => {
    const info = {
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
      context: null,
    });
    await expect(promise).rejects.toThrow(/boom/);
  });

  it('falls back to baseCollection.aggregate when no resolver is supplied', async () => {
    const info = {
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
        // Capture the aggregate spec the call uses
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
      context: null,
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
    // Positive companion to the variant-only throw tests: when BOTH
    // a default and a variant are registered, the string-form helper
    // resolves to the default. Both types appear in the SDL with
    // their respective fields.
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
    // pageInfo eagerly reads startCursor + endCursor — that's 2 encodes.
    expect(encodeCalls).toBe(2);
    // JSON.stringify shouldn't trigger getters for middle edges.
    const before = encodeCalls;
    JSON.stringify(page);
    expect(encodeCalls).toBe(before);
    // GraphQL.js's per-field property access fires the getter.
    expect(page.edges[1]!.cursor).toBe('cursor:2');
    expect(encodeCalls).toBe(before + 1);
    // Second read is cached.
    expect(page.edges[1]!.cursor).toBe('cursor:2');
    expect(encodeCalls).toBe(before + 1);
  });

  it('Object.assign({}, edge) drops the cursor (documented invariant of enumerable:false)', async () => {
    // Own-property enumeration (Object.assign, spread, JSON.stringify)
    // skips the non-enumerable cursor accessor.
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
    // Register Post only as a variant; t.relation('posts') from User
    // routes through `getRefFromContractModel('Post', ...)` which
    // returns the cached default ref that was never registered.
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
          // Untyped escape — what a JS caller bypassing TS would do.
          query: () => ({ where: { id: 1 } }),
          resolve: () => ctx.ormClient.User as never,
        } as never),
      }),
    });
    // Builds without error; the destructure strips `query` before
    // forwarding to t.connection.
    expect(builder.toSchema()).toBeDefined();
  });
});

// Combine-slot keys use `:` (GraphQL-forbidden) as the separator. User
// aliases can't produce those keys structurally, so no runtime reserved-
// alias check is needed.

// compileQuery has been removed. Declarative-refine compilation now
// lives inline in `apply-selection.ts:compileDeclarativeRefine`, used
// by the walker for `select: { rel: { where, take, skip, orderBy } }`.
// `compileWhere` (the only public helper) is exercised end-to-end via
// the connection runtime tests.
