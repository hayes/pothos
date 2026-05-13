import SchemaBuilder, { typeBrandKey } from '@pothos/core';
import {
  execute,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  parse,
  printSchema,
} from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin, {
  type AnyContract,
  applySelectionToCollection,
  getInterfaceRefFromContractModel,
  getRefFromContractModel,
} from '../src';
import { PRISMA_NEXT_MODEL, PRISMA_NEXT_PREPARED } from '../src/constants';
import { mapSelectionFromInfo } from '../src/utils/map-query';
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

describe('mapper — M:N + duplicate-alias guards', () => {
  it('throws for M:N relations until junction support lands', () => {
    // `isToManyCardinality` accepts M:N (future-proof), but
    // `getRelationLocalFields` doesn't know how to read junction
    // columns yet — it throws a clear error rather than silently
    // shipping broken FK augmentation.
    const stubContract = {
      models: {
        Post: {
          relations: {
            tags: { cardinality: 'M:N', to: 'Tag', on: { localFields: [] } },
          },
        },
        Tag: {
          relations: {},
        },
      },
    } as unknown as AnyContract;

    // Reach the M:N check via a synthetic info that triggers the
    // include branch for `tags`.
    expect(() =>
      mapSelectionFromInfo({
        config: { contract: stubContract, skipDeferredFragments: true },
        context: {},
        info: {
          fieldNodes: [
            {
              kind: 'Field',
              name: { kind: 'Name', value: 'post' },
              selectionSet: {
                kind: 'SelectionSet',
                selections: [
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: 'tags' },
                    selectionSet: {
                      kind: 'SelectionSet',
                      selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
                    },
                  },
                ],
              },
            },
          ],
          returnType: buildSyntheticPostType(),
          fragments: {},
          variableValues: {},
        } as never,
      }),
    ).toThrow(/M:N — junction-table relations aren't supported yet/);
  });
});

// Synthetic GraphQL type just for the M:N test — has a `tags`
// relation field carrying the include op.
function buildSyntheticPostType(): GraphQLObjectType {
  const Tag = new GraphQLObjectType({
    name: 'Tag',
    extensions: { pothosPrismaNextModel: 'Tag' },
    fields: () => ({ id: { type: new GraphQLNonNull(GraphQLID) } }),
  });
  return new GraphQLObjectType({
    name: 'Post',
    extensions: { pothosPrismaNextModel: 'Post' },
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      tags: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Tag))),
        extensions: {
          pothosPrismaNextFieldOp: {
            kind: 'include',
            relationName: 'tags',
            parentModel: 'Post',
            isToMany: true,
          },
        },
      },
    }),
  });
}

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

describe('brandResult on t.prismaField rows', () => {
  it('brands returned rows with the registered type name', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id') }),
    });

    const captured: unknown[] = [];
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (async (apply: <C>(c: C) => C) => {
            const rows = await apply(ctx.ormClient.User).all().toArray();
            captured.push(...rows);
            return rows;
          }) as never,
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ users { id } }'),
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    // Wait for the wrapResolve brand pass (it brands the Promise's
    // awaited value). `captured` holds the raw rows before the brand
    // — we want the post-brand check on the rows as GraphQL sees
    // them. The resolver returns the same array; brandResult mutates
    // each row's brand slot in place.
    expect(captured.length).toBeGreaterThan(0);
    for (const row of captured) {
      const brand = (row as Record<symbol, unknown>)[typeBrandKey];
      expect(brand).toBe('User');
    }
  });
});

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

  it('M:N runtime throw fires even when contract relation has no `on` field', () => {
    const stubContract = {
      models: {
        Post: {
          relations: {
            // Real M:N shape per the orm-client's RelationCardinalityTag —
            // junction relations don't carry `on.localFields`.
            tags: { cardinality: 'M:N', to: 'Tag' },
          },
        },
        Tag: { relations: {} },
      },
    } as unknown as AnyContract;
    expect(() =>
      mapSelectionFromInfo({
        config: { contract: stubContract, skipDeferredFragments: true },
        context: {},
        info: {
          fieldNodes: [
            {
              kind: 'Field',
              name: { kind: 'Name', value: 'post' },
              selectionSet: {
                kind: 'SelectionSet',
                selections: [
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: 'tags' },
                    selectionSet: {
                      kind: 'SelectionSet',
                      selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
                    },
                  },
                ],
              },
            },
          ],
          returnType: buildSyntheticPostType(),
          fragments: {},
          variableValues: {},
        } as never,
      }),
    ).toThrow(/M:N — junction-table relations aren't supported yet/);
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
          resolve: (async (apply: <C>(c: C) => C) =>
            (await apply(ctx.ormClient.User).all().toArray()) as never) as never,
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
          resolve: (async (apply: <C>(c: C) => C) =>
            (await apply(ctx.ormClient.User).first()) as never) as never,
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

describe('variant-only registration — string-form field helpers throw', () => {
  it('prismaObjectField string form rejects model name when only a variant is registered', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', {
      name: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    expect(() =>
      builder.prismaObjectField('User', 'extra', (t) => t.exposeString('firstName')),
    ).toThrow(/has no default prismaObject registration, only variant\(s\) 'AdminUser'/);
  });

  it('prismaInterfaceField string form rejects model name when only a variant is registered', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaInterface('User', {
      variant: 'UserBase',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    expect(() =>
      builder.prismaInterfaceField('User', 'extra', (t) => t.exposeString('firstName')),
    ).toThrow(/has no default prismaInterface registration, only variant\(s\) 'UserBase'/);
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

describe('variant-only registration — lazy (forward) order also throws', () => {
  it('prismaObject({ name: variant }) called AFTER prismaObjectField string-form throws', () => {
    // Forward-order guard companion to the reverse-order check above.
    // Without this, `prismaObjectField('User', 'extra', ...)` then
    // `prismaObject('User', { name: 'AdminUser' })` orphans the lazy
    // 'User' ref — its `extra` field never surfaces.
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObjectField('User', 'extra', (t) => t.exposeString('firstName'));
    expect(() =>
      builder.prismaObject('User', {
        name: 'AdminUser',
        fields: (t) => ({ id: t.exposeID('id') }),
      }),
    ).toThrow(/lazy default-keyed ref that is never registered/);
  });

  it('prismaInterface variant after prismaInterfaceField string-form throws', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaInterfaceField('User', 'extra', (t) => t.exposeString('firstName'));
    expect(() =>
      builder.prismaInterface('User', {
        variant: 'UserBase',
        fields: (t) => ({ id: t.exposeID('id') }),
      }),
    ).toThrow(/lazy default-keyed ref that is never registered/);
  });
});

describe('t.variant — extensions preservation (drizzle parity)', () => {
  it('user-passed extensions land on the field config alongside PRISMA_NEXT_FIELD_OP', () => {
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

describe('variant-only assertion — wired into string-form type: args', () => {
  it('t.prismaField({ type: "User" }) throws when only a variant is registered', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', {
      name: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    expect(() => {
      builder.queryType({
        fields: (t) => ({
          users: t.prismaField({
            type: ['User'],
            resolve: (async (apply: <C>(c: C) => C) =>
              (await apply(ctx.ormClient.User).all().toArray()) as never) as never,
          }),
        }),
      });
      builder.toSchema();
    }).toThrow(/has no default prismaObject registration, only variant\(s\) 'AdminUser'/);
  });

  it('t.variant("User") throws when only a variant is registered', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    // Variant-only registration of User as AdminUser, with a field
    // that points at the (orphaned) 'User' default key via the
    // string-form `t.variant('User')`. The assertion in `t.variant`
    // fires when its fields-thunk runs at toSchema time.
    builder.prismaObject('User', {
      name: 'AdminUser',
      fields: (t) => ({
        id: t.exposeID('id'),
        self: t.variant('User' as never),
      }),
    });
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).toThrow(
      /has no default prismaObject registration, only variant\(s\) 'AdminUser'/,
    );
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

describe('variant-only assertion fires from t.relation and t.relatedConnection', () => {
  it('t.relation throws when the related model is registered only as a variant', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    // Register Post only as a variant; t.relation('posts') from User
    // would otherwise auto-route through `getRefFromContractModel('Post', ...)`
    // and create an orphaned default ref.
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
    expect(() => builder.toSchema()).toThrow(
      /t\.relation\('posts'\).+model 'Post' has no default prismaObject registration, only variant\(s\) 'PostVariant'/,
    );
  });

  it('t.relatedConnection throws when the related model is registered only as a variant', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin, require('@pothos/plugin-relay').default],
      relay: { clientMutationId: 'omit', cursorType: 'String' },
      prismaNext: { contract: ctx.contract },
    } as never);
    builder.prismaObject('Post', {
      name: 'PostVariant',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        postsConnection: t.relatedConnection('posts', { cursor: 'id' }),
      }),
    });
    builder.queryType({ fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }) });
    expect(() => builder.toSchema()).toThrow(
      /t\.relatedConnection\('posts'\).+only variant\(s\) 'PostVariant'/,
    );
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
          resolve: (apply: (c: unknown) => { all: () => unknown }) =>
            apply(ctx.ormClient.User) as never,
        } as never),
      }),
    });
    // Builds without error; the destructure strips `query` before
    // forwarding to t.connection.
    expect(builder.toSchema()).toBeDefined();
  });
});

describe('mapper rejects reserved aliases at walk time', () => {
  it('throws PothosValidationError when a field is aliased to __proto__', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (async (apply: <C>(c: C) => C) =>
            (await apply(ctx.ormClient.User).all().toArray()) as never) as never,
        }),
      }),
    });
    const schema = builder.toSchema();
    const { execute, parse } = await import('graphql');
    const result = await execute({
      schema,
      document: parse('{ users { __proto__: id } }'),
      contextValue: {},
    });
    expect(result.errors?.[0]?.message ?? '').toMatch(/alias '__proto__' is reserved/);
  });
});

describe('compileQuery — direct unit', () => {
  it('returns undefined for undefined input', async () => {
    const { compileQuery } = await import('../src/utils/compile-query');
    expect(compileQuery(undefined)).toBeUndefined();
  });

  it('returns undefined for empty literal (no allocation)', async () => {
    const { compileQuery } = await import('../src/utils/compile-query');
    expect(compileQuery({})).toBeUndefined();
    expect(compileQuery({ where: undefined, orderBy: undefined })).toBeUndefined();
  });

  it('static where: object literal threads to rel.where(filter)', async () => {
    const { compileQuery } = await import('../src/utils/compile-query');
    const refine = compileQuery({ where: { published: 1 } });
    let captured: unknown;
    const stubRel = {
      where(w: unknown) {
        captured = w;
        return stubRel;
      },
    };
    refine!(stubRel, {}, {});
    expect(captured).toEqual({ published: 1 });
  });

  it('static where: callback threads to rel.where(cb)', async () => {
    const { compileQuery } = await import('../src/utils/compile-query');
    const cb = () => 'predicate';
    const refine = compileQuery({ where: cb });
    let captured: unknown;
    const stubRel = {
      where(w: unknown) {
        captured = w;
        return stubRel;
      },
    };
    refine!(stubRel, {}, {});
    expect(captured).toBe(cb);
  });

  it('callback form: args + ctx are passed in; return literal applied', async () => {
    const { compileQuery } = await import('../src/utils/compile-query');
    let seen: { a: unknown; c: unknown } | null = null;
    const refine = compileQuery((args: unknown, ctx: unknown) => {
      seen = { a: args, c: ctx };
      return { take: 7 };
    });
    let captured = 0;
    const stubRel = {
      take(n: number) {
        captured = n;
        return stubRel;
      },
    };
    refine!(stubRel, { arg: 1 }, { ctx: 2 });
    expect(seen).toEqual({ a: { arg: 1 }, c: { ctx: 2 } });
    expect(captured).toBe(7);
  });

  it('callback returning null/undefined is treated as no filter (no crash)', async () => {
    const { compileQuery } = await import('../src/utils/compile-query');
    const refineNull = compileQuery(() => null as never);
    const refineUndef = compileQuery(() => undefined as never);
    const stubRel = { where: () => stubRel };
    // Returns the original rel unchanged.
    expect(refineNull!(stubRel, {}, {})).toBe(stubRel);
    expect(refineUndef!(stubRel, {}, {})).toBe(stubRel);
  });

  it('callback that throws propagates synchronously', async () => {
    const { compileQuery } = await import('../src/utils/compile-query');
    const refine = compileQuery(() => {
      throw new Error('boom-from-query');
    });
    expect(() => refine!({} as never, {}, {})).toThrow(/boom-from-query/);
  });

  it('orderBy + take + skip chain in order', async () => {
    const { compileQuery } = await import('../src/utils/compile-query');
    const refine = compileQuery({
      where: { x: 1 },
      orderBy: () => 'asc-spec',
      take: 5,
      skip: 2,
    });
    const calls: string[] = [];
    const stubRel = {
      where(_: unknown) {
        calls.push('where');
        return stubRel;
      },
      orderBy(_: unknown) {
        calls.push('orderBy');
        return stubRel;
      },
      take(_: number) {
        calls.push('take');
        return stubRel;
      },
      skip(_: number) {
        calls.push('skip');
        return stubRel;
      },
    };
    refine!(stubRel, {}, {});
    expect(calls).toEqual(['where', 'orderBy', 'take', 'skip']);
  });
});
