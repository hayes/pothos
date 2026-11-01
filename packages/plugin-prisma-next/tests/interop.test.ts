import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '@pothos/plugin-with-input';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { createBuilder, run, type SampleContract, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

describe('plugin-with-input', () => {
  it('passes the input to prismaFieldWithInput, or undefined when an optional input is omitted', async () => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [WithInputPlugin, prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id'), firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        byEmail: t.prismaFieldWithInput({
          type: 'User',
          nullable: true,
          input: { email: t.input.string({ required: true }) },
          resolve: (_root, args) => db.orm.User.where({ email: args.input.email }),
        }),
        optional: t.prismaFieldWithInput({
          type: 'User',
          nullable: true,
          argOptions: { required: false },
          input: { email: t.input.string({ required: true }) },
          resolve: (_root, args) => {
            seen.push(args.input);
            return db.orm.User.where({ email: args.input?.email ?? 'alice@example.com' });
          },
        }),
      }),
    });
    const schema = builder.toSchema();
    const result = await run(
      schema,
      '{ byEmail(input: { email: "bob@example.com" }) { id firstName } omitted: optional { id } explicit: optional(input: null) { id } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      byEmail: { id: 'u-bob', firstName: 'Bob' },
      omitted: { id: 'u-alice' },
      explicit: { id: 'u-alice' },
    });
    expect(seen).toEqual([undefined, null]);
  });
});

describe('plugin-errors', () => {
  it('forwards errors options through t.relation', async () => {
    const builder = createBuilder();
    class CustomError extends Error {}
    builder.objectType(CustomError, {
      name: 'CustomError',
      fields: (t) => ({ message: t.exposeString('message') }),
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        author: t.relation('author', { errors: { types: [CustomError] } }),
      }),
    });
    builder.queryType({
      fields: (t) => ({ posts: t.prismaField({ type: ['Post'], resolve: () => db.orm.Post }) }),
    });
    const schema = builder.toSchema();
    expect(schema.getType('PostAuthorResult')).toBeDefined();
    expect(schema.getType('PostAuthorSuccess')).toBeDefined();
    const result = await run(
      schema,
      '{ posts { id author { __typename ... on PostAuthorSuccess { data { id } } } } }',
    );
    expect(result.errors).toBeUndefined();
    const success = (id: string) => ({ __typename: 'PostAuthorSuccess', data: { id } });
    expect(result.data).toEqual({
      posts: [
        { id: 'p-hello', author: success('u-alice') },
        { id: 'p-draft1', author: success('u-alice') },
        { id: 'p-bob1', author: success('u-bob') },
        { id: 'p-bob-draft', author: success('u-bob') },
      ],
    });
  });

  it('materializes a list inside a root success wrapper as a list', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], errors: { types: [] }, resolve: () => db.orm.User }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { ... on QueryUsersSuccess { data { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: { data: [{ id: 'u-alice' }, { id: 'u-bob' }] } });
  });
});
