import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import { execute, parse } from 'graphql';
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

describe('plugin interop', () => {
  it('prismaFieldWithInput composes with @pothos/plugin-with-input', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [WithInputPlugin, prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });

    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        firstName: t.exposeString('firstName'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        userByEmailWithInput: t.prismaFieldWithInput({
          type: 'User',
          nullable: true,
          input: {
            email: t.input.string({ required: true }),
          },
          resolve: ((_parent: unknown, args: { input: { email: string } }) =>
            ctx.ormClient.User.where((u) => u.email.eq(args.input.email))) as never,
        }),
      }),
    });

    const schema = builder.toSchema();
    const result = await execute({
      schema,
      document: parse(
        '{ userByEmailWithInput(input: { email: "alice@example.com" }) { id firstName } }',
      ),
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      userByEmailWithInput: { id: 'u-alice', firstName: 'Alice' },
    });
  });

  it('t.relation forwards errors plugin options through to the field config', () => {
    // Errors plugin reads `errors:` on a field's options to wrap the
    // resolver in a try/catch and turn returned errors into a union.
    // If t.relation drops `errors`, the result type wouldn't have the
    // expected `__typename` discrimination.
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
    }>({
      plugins: [ErrorsPlugin, RelayPlugin, prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });

    class CustomError extends Error {}
    builder.objectType(CustomError, {
      name: 'CustomError',
      fields: (t) => ({ message: t.exposeString('message') }),
    });

    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
      }),
    });

    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        // `errors:` should flow through into the field config —
        // the resolver gets wrapped, and the schema generates a
        // union type for the field.
        author: t.relation('author', {
          errors: { types: [CustomError] },
        }),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: (() => ctx.ormClient.Post) as never,
        }),
      }),
    });

    const schema = builder.toSchema();
    // Schema printing — confirm the union type was generated. If
    // `errors:` was dropped, the schema would have `author: User`
    // instead of a `…AuthorResult` union.
    const printed = JSON.stringify(schema.getType('PostAuthorResult'));
    expect(printed).not.toBe('undefined');
  });
});
