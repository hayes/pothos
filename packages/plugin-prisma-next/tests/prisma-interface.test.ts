import SchemaBuilder from '@pothos/core';
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

function buildSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: {
      contract: ctx.contract,
    },
  });

  // The interface — `prismaInterface('User', …)` registers a GraphQL
  // Interface named 'User' backed by the User contract model. Returns
  // a `PrismaNextInterfaceRef` users pass into the
  // `interfaces: [...]` array on implementing prismaObjects.
  const userIface = builder.prismaInterface('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
    }),
  });

  // Cross-file field addition via `prismaInterfaceFields` — exercises
  // the schema-builder route that wasn't otherwise touched by tests.
  builder.prismaInterfaceFields(userIface, (t) => ({
    firstName: t.exposeString('firstName'),
  }));

  // Concrete implementations: two prismaObject variants of the User
  // model, each implementing the User interface. `isTypeOf` decides
  // which type a row routes to.
  const adminRef = builder.prismaObject('User', {
    name: 'AdminUser',
    interfaces: [userIface],
    isTypeOf: (val) => (val as { firstName?: string }).firstName === 'Alice',
    fields: (t) => ({
      lastName: t.exposeString('lastName'),
    }),
  });

  const regularRef = builder.prismaObject('User', {
    name: 'RegularUser',
    interfaces: [userIface],
    isTypeOf: (val) => (val as { firstName?: string }).firstName !== 'Alice',
    fields: (t) => ({
      email: t.exposeString('email'),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      // Return rows typed as the interface via a hand-rolled
      // `t.field`. `t.prismaField` doesn't currently accept interface
      // refs (resolveModelAndRef expects PrismaNextObjectRef), so we
      // use the underlying orm directly and let isTypeOf dispatch.
      users: t.field({
        type: [userIface],
        resolve: async () => {
          const rows = await ctx.ormClient.User.all().toArray();
          return rows as never;
        },
      }),
      admins: t.field({ type: [adminRef], resolve: () => [] }),
      regulars: t.field({ type: [regularRef], resolve: () => [] }),
    }),
  });

  return builder.toSchema();
}

describe('prismaInterface family', () => {
  it('registers an interface backed by a contract model', () => {
    const schema = buildSchema();
    const sdl = printSchema(schema);
    expect(sdl).toMatch(/interface User\b/);
    expect(sdl).toMatch(/type AdminUser\b.*implements User/s);
    expect(sdl).toMatch(/type RegularUser\b.*implements User/s);
  });

  it('exposes interface fields from `prismaInterface` + `prismaInterfaceFields`', () => {
    const schema = buildSchema();
    const sdl = printSchema(schema);
    // `id` (from prismaInterface options.fields) and `firstName`
    // (added via prismaInterfaceFields) should both appear on the
    // interface itself.
    const ifaceBlock = sdl.match(/interface User\b[^}]*\}/)?.[0] ?? '';
    expect(ifaceBlock).toMatch(/\bid: ID/);
    expect(ifaceBlock).toMatch(/\bfirstName: String/);
  });

  it('routes rows to concrete types via isTypeOf', async () => {
    const result = await execute({
      schema: buildSchema(),
      document: parse(`{
        users {
          __typename
          id
          firstName
          ... on AdminUser { lastName }
          ... on RegularUser { email }
        }
      }`),
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        __typename: string;
        id: string;
        firstName: string;
        lastName?: string;
        email?: string;
      }>;
    };
    const alice = data.users.find((u) => u.firstName === 'Alice');
    const bob = data.users.find((u) => u.firstName === 'Bob');
    expect(alice?.__typename).toBe('AdminUser');
    expect(alice?.lastName).toBe('Andrews');
    expect(bob?.__typename).toBe('RegularUser');
    expect(bob?.email).toBe('bob@example.com');
  });
});
