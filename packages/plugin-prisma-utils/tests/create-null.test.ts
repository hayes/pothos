import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import { graphql } from 'graphql';
import PrismaUtils from '../src';
import type PrismaTypes from './generated';
import { getDatamodel } from './generated';

it.each([
  'prismaCreate',
  'prismaCreateMany',
] as const)('%s preserves nullable fields and normalizes non-null fields', async (method) => {
  const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
    plugins: [PrismaPlugin, PrismaUtils],
    prisma: { client: {} as never, dmmf: getDatamodel() },
  });
  const CreateUser = builder[method]('User', { fields: { name: 'String', id: 'Int' } });
  builder.queryType({
    fields: (t) => ({
      create: t.string({
        args: { input: t.arg({ type: CreateUser, required: true }) },
        resolve: (_parent, { input }) => JSON.stringify(input),
      }),
    }),
  });
  const result = await graphql({
    schema: builder.toSchema(),
    source: `{
      explicitNull: create(input: { name: null, id: null })
      value: create(input: { name: "Alice" })
      omitted: create(input: {})
    }`,
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    explicitNull: '{"name":null}',
    value: '{"name":"Alice"}',
    omitted: '{}',
  });
});

it('omits null optional relation inputs instead of passing null to Prisma', async () => {
  const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
    plugins: [PrismaPlugin, PrismaUtils],
    prisma: { client: {} as never, dmmf: getDatamodel() },
  });
  const Profile = builder.prismaCreate('Profile', { fields: { bio: 'String' } });
  const Relation = builder.prismaCreateRelation('User', 'profile', {
    fields: { create: Profile },
  });
  const User = builder.prismaCreate('User', { fields: { name: 'String', profile: Relation } });
  builder.queryType({
    fields: (t) => ({
      create: t.string({
        args: { input: t.arg({ type: User, required: true }) },
        resolve: (_parent, { input }) => JSON.stringify(input),
      }),
    }),
  });
  const result = await graphql({
    schema: builder.toSchema(),
    source: '{ create(input: { name: null, profile: null }) }',
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ create: '{"name":null}' });
});
