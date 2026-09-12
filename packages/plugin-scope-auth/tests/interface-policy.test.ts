import SchemaBuilder from '@pothos/core';
import {
  execute,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  graphql,
  subscribe,
} from 'graphql';
import { gql } from 'graphql-tag';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import { db } from './example/db';
import exampleSchema from './example/schema';
import User from './example/user';

interface Scopes {
  admin: boolean;
  objOk: boolean;
}

interface Context extends Scopes {
  counts: Record<string, number>;
}

function count(context: Context, name: string) {
  context.counts[name] = (context.counts[name] ?? 0) + 1;
}

function createContext(scopes: Partial<Scopes> = {}): Context {
  return { admin: false, objOk: false, ...scopes, counts: {} };
}

function createBuilder(runScopesOnType = false) {
  return new SchemaBuilder<{ Context: Context; AuthScopes: Scopes }>({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: {
      runScopesOnType,
      authScopes: (context) => ({ admin: context.admin, objOk: context.objOk }),
    },
  });
}

function run(schema: GraphQLSchema, source: string, context: Context) {
  return graphql({ schema, source, contextValue: context });
}

/**
 * The original report: `Readable` grants `read` and declares `secret`, which requires it. `Denied`
 * implements `Readable` and denies everything, `Allowed` implements it with no policy of its own.
 */
function createLeakSchema() {
  const builder = createBuilder();

  const Readable = builder.interfaceRef<{ kind: string }>('Readable').implement({
    grantScopes: (_parent, context) => {
      count(context, 'Readable.grantScopes');

      return ['read'];
    },
    resolveType: (parent) => parent.kind,
    fields: (t) => ({
      secret: t.string({ authScopes: { $granted: 'read' }, resolve: () => 'ok' }),
      alsoSecret: t.string({ authScopes: { $granted: 'read' }, resolve: () => 'ok' }),
    }),
  });

  const Denied = builder.objectRef<{ kind: string }>('Denied').implement({
    interfaces: [Readable],
    authScopes: (_parent, context) => {
      count(context, 'Denied.authScopes');

      return false;
    },
    fields: (t) => ({
      own: t.string({ authScopes: { $granted: 'read' }, resolve: () => 'ok' }),
    }),
  });

  const Allowed = builder.objectRef<{ kind: string }>('Allowed').implement({
    interfaces: [Readable],
    fields: (t) => ({
      own: t.string({ resolve: () => 'ok' }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      denied: t.field({ type: Denied, nullable: true, resolve: () => ({ kind: 'Denied' }) }),
      allowed: t.field({ type: Allowed, nullable: true, resolve: () => ({ kind: 'Allowed' }) }),
      deniedAsIface: t.field({
        type: Readable,
        nullable: true,
        resolve: () => ({ kind: 'Denied' }),
      }),
      allowedAsIface: t.field({
        type: Readable,
        nullable: true,
        resolve: () => ({ kind: 'Allowed' }),
      }),
    }),
  });

  return builder.toSchema();
}

const leakSchema = createLeakSchema();

describe('policy of the implementing type on inherited interface fields', () => {
  it('runs the implementing object authScopes for a field declared by an interface', async () => {
    const result = await run(leakSchema, '{ denied { secret own } }', createContext());

    expect(result.data).toEqual({ denied: { secret: null, own: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for Denied',
      'Not authorized to read fields for Denied',
    ]);
  });

  it('keeps denying an object declared field (regression)', async () => {
    const result = await run(leakSchema, '{ denied { own } }', createContext());

    expect(result.data).toEqual({ denied: { own: null } });
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].message).toBe('Not authorized to read fields for Denied');
    expect(result.errors?.[0].path).toEqual(['denied', 'own']);
  });

  it('makes the same decision when the field is queried through the interface type', async () => {
    const result = await run(leakSchema, '{ deniedAsIface { secret } }', createContext());

    expect(result.data).toEqual({ deniedAsIface: { secret: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for Denied',
    ]);
  });

  it('still resolves inherited fields for an implementer with no policy of its own', async () => {
    const result = await run(leakSchema, '{ allowed { secret own } }', createContext());

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ allowed: { secret: 'ok', own: 'ok' } });
  });

  it('keeps interface grantScopes working for interface declared fields', async () => {
    const result = await run(leakSchema, '{ allowedAsIface { secret } }', createContext());

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ allowedAsIface: { secret: 'ok' } });
  });

  it('runs the interface grant callback once per instance regardless of field order', async () => {
    const context = createContext();
    const result = await run(leakSchema, '{ allowed { secret alsoSecret own } }', context);

    expect(result.errors).toBeUndefined();
    expect(context.counts['Readable.grantScopes']).toBe(1);

    const reversed = createContext();
    const reversedResult = await run(leakSchema, '{ allowed { alsoSecret secret own } }', reversed);

    expect(reversedResult.errors).toBeUndefined();
    expect(reversed.counts['Readable.grantScopes']).toBe(1);
  });

  it('escapes no interface of the implementing type (existing fixture)', async () => {
    const result = await execute({
      schema: exampleSchema,
      document: gql`
        query {
          ObjAdminIface {
            stringInterfaceField
          }
        }
      `,
      contextValue: { user: new User({}) },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjAdminIface": {
            "stringInterfaceField": null,
          },
        },
        "errors": [
          [GraphQLError: Not authorized to read fields for IfaceForAdmin],
        ],
      }
    `);
  });

  it('still resolves the same inherited field when the implementing type authorizes', async () => {
    const result = await execute({
      schema: exampleSchema,
      document: gql`
        query {
          ObjAdminIface {
            stringInterfaceField
          }
        }
      `,
      contextValue: { user: new User({ 'x-user-id': '1', 'x-roles': 'admin' }) },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "ObjAdminIface": {
            "stringInterfaceField": "test",
          },
        },
      }
    `);
  });
});

describe('grantScopes of the implementing type on inherited interface fields', () => {
  const builder = createBuilder();

  const NeedsGrant = builder.interfaceRef<{ kind: string }>('NeedsGrant').implement({
    resolveType: (parent) => parent.kind,
    fields: (t) => ({
      granted: t.string({ authScopes: { $granted: 'fromObject' }, resolve: () => 'ok' }),
    }),
  });

  const Granter = builder.objectRef<{ kind: string }>('Granter').implement({
    interfaces: [NeedsGrant],
    grantScopes: () => ['fromObject'],
    fields: () => ({}),
  });

  const NonGranter = builder.objectRef<{ kind: string }>('NonGranter').implement({
    interfaces: [NeedsGrant],
    fields: () => ({}),
  });

  builder.queryType({
    fields: (t) => ({
      granter: t.field({ type: Granter, nullable: true, resolve: () => ({ kind: 'Granter' }) }),
      nonGranter: t.field({
        type: NonGranter,
        nullable: true,
        resolve: () => ({ kind: 'NonGranter' }),
      }),
    }),
  });

  const schema = builder.toSchema();

  it('applies the implementing type grantScopes to inherited fields', async () => {
    const result = await run(schema, '{ granter { granted } }', createContext());

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ granter: { granted: 'ok' } });
  });

  it('denies when neither the interface nor the implementing type grants the scope', async () => {
    const result = await run(schema, '{ nonGranter { granted } }', createContext());

    expect(result.data).toEqual({ nonGranter: { granted: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to resolve NonGranter.granted',
    ]);
  });
});

describe('runScopesOnType with inherited interface fields', () => {
  const builder = createBuilder(true);

  const Iface = builder.interfaceRef<{ kind: string }>('RunOnTypeIface').implement({
    resolveType: (parent) => parent.kind,
    fields: (t) => ({
      inherited: t.string({ resolve: () => 'ok' }),
    }),
  });

  const Obj = builder.objectRef<{ kind: string }>('RunOnTypeObj').implement({
    interfaces: [Iface],
    isTypeOf: () => true,
    authScopes: (_parent, context) => {
      count(context, 'RunOnTypeObj.authScopes');

      return context.objOk;
    },
    fields: (t) => ({
      own: t.string({ resolve: () => 'ok' }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      obj: t.field({ type: Obj, nullable: true, resolve: () => ({ kind: 'RunOnTypeObj' }) }),
    }),
  });

  const schema = builder.toSchema();

  it('already denied inherited fields before this change', async () => {
    const result = await run(schema, '{ obj { inherited } }', createContext());

    expect(result.data).toEqual({ obj: null });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for RunOnTypeObj',
    ]);
  });

  it('runs the type scopes exactly once, in isTypeOf, for an inherited field', async () => {
    const context = createContext({ objOk: true });
    const result = await run(schema, '{ obj { inherited own } }', context);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ obj: { inherited: 'ok', own: 'ok' } });
    expect(context.counts['RunOnTypeObj.authScopes']).toBe(1);
  });
});

describe('skipTypeScopes and skipInterfaceScopes with inherited interface fields', () => {
  const builder = createBuilder();

  const AdminIface = builder.interfaceRef<{ kind: string }>('SkipAdminIface').implement({
    authScopes: { admin: true },
    resolveType: (parent) => parent.kind,
    fields: (t) => ({
      checked: t.string({ resolve: () => 'ok' }),
      skipsType: t.string({ skipTypeScopes: true, resolve: () => 'ok' }),
    }),
  });

  const SkipObj = builder.objectRef<{ kind: string }>('SkipObj').implement({
    interfaces: [AdminIface],
    authScopes: { objOk: true },
    skipInterfaceScopes: true,
    fields: () => ({}),
  });

  builder.queryType({
    fields: (t) => ({
      obj: t.field({ type: SkipObj, nullable: true, resolve: () => ({ kind: 'SkipObj' }) }),
    }),
  });

  const schema = builder.toSchema();

  it('denies an inherited field on the implementing type scopes', async () => {
    const result = await run(schema, '{ obj { checked } }', createContext({ admin: true }));

    expect(result.data).toEqual({ obj: { checked: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for SkipObj',
    ]);
  });

  it('keeps the declaring interface scopes even when the object skips interface scopes', async () => {
    const result = await run(schema, '{ obj { checked } }', createContext({ objOk: true }));

    expect(result.data).toEqual({ obj: { checked: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for SkipAdminIface',
    ]);
  });

  it('honors skipTypeScopes on the interface field for both the interface and the object', async () => {
    const result = await run(schema, '{ obj { skipsType } }', createContext());

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ obj: { skipsType: 'ok' } });
  });

  it('resolves when both the interface and the implementing type authorize', async () => {
    const result = await run(
      schema,
      '{ obj { checked } }',
      createContext({ admin: true, objOk: true }),
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ obj: { checked: 'ok' } });
  });
});

describe('subscriptions with inherited interface fields', () => {
  const builder = new SchemaBuilder<{ Context: Context; AuthScopes: Scopes }>({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: {
      authorizeOnSubscribe: true,
      authScopes: (context) => ({ admin: context.admin, objOk: context.objOk }),
    },
  });

  const Payload = builder.interfaceRef<{ kind: string }>('PayloadIface').implement({
    resolveType: (parent) => parent.kind,
    fields: (t) => ({
      inherited: t.string({ resolve: () => 'ok' }),
    }),
  });

  const DeniedPayload = builder.objectRef<{ kind: string }>('DeniedPayload').implement({
    interfaces: [Payload],
    authScopes: { objOk: true },
    fields: () => ({}),
  });

  builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

  builder.subscriptionType({
    fields: (t) => ({
      events: t.field({
        type: DeniedPayload,
        nullable: true,
        subscribe: async function* subscribeEvents() {
          yield await Promise.resolve({ kind: 'DeniedPayload' });
        },
        resolve: (payload) => payload,
      }),
    }),
  });

  const schema = builder.toSchema();

  async function firstResult(context: Context) {
    const result = await subscribe({
      schema,
      document: gql`
        subscription {
          events {
            inherited
          }
        }
      `,
      contextValue: context,
    });

    for await (const value of result as AsyncIterable<unknown>) {
      return value as { data?: unknown; errors?: readonly { message: string }[] };
    }

    throw new Error('no results');
  }

  it('applies the payload type scopes to inherited fields', async () => {
    const result = await firstResult(createContext());

    expect(result.data).toEqual({ events: { inherited: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for DeniedPayload',
    ]);
  });

  it('resolves inherited fields when the payload type authorizes', async () => {
    const result = await firstResult(createContext({ objOk: true }));

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ events: { inherited: 'ok' } });
  });
});

describe('concrete types with no Pothos config', () => {
  const builder = createBuilder();

  const FallbackIface = builder.interfaceRef<{ kind: string }>('FallbackIface').implement({
    authScopes: { admin: true },
    resolveType: (parent) => parent.kind,
    fields: (t) => ({
      name: t.string({ resolve: () => 'ok' }),
    }),
  });

  const FallbackObj = builder.objectRef<{ kind: string }>('FallbackObj').implement({
    interfaces: [FallbackIface],
    fields: () => ({}),
  });

  builder.queryType({
    fields: (t) => ({
      obj: t.field({ type: FallbackObj, nullable: true, resolve: () => ({ kind: 'FallbackObj' }) }),
    }),
  });

  const schema = builder.toSchema();

  async function resolveWithParentType(typeName: string, context: Context) {
    const objectType = schema.getType('FallbackObj') as GraphQLObjectType;
    const resolve = objectType.getFields().name.resolve!;

    return await resolve({ kind: 'FallbackObj' }, {}, context, {
      parentType: { name: typeName },
      fieldName: 'name',
      path: {
        prev: { prev: undefined, key: 'obj', typename: 'Query' },
        key: 'name',
        typename: typeName,
      },
    } as unknown as GraphQLResolveInfo);
  }

  it('falls back to the declaring interface policy instead of throwing', async () => {
    await expect(resolveWithParentType('NotAPothosType', createContext())).rejects.toThrow(
      'Not authorized to read fields for FallbackIface',
    );
  });

  it('resolves normally through the fallback when the interface policy passes', async () => {
    await expect(
      resolveWithParentType('NotAPothosType', createContext({ admin: true })),
    ).resolves.toBe('ok');
  });
});
