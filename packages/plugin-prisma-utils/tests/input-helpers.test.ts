import SchemaBuilder from '@pothos/core';
import type { PrismaModelTypes } from '@pothos/plugin-prisma';
import type { GraphQLInputObjectType } from 'graphql';
import { describe, expect, it } from 'vitest';
import PrismaUtils from '../src';

// These tests only exercise the input-helper builders, which never touch the prisma
// client or the database, so they run without a generated client.
type ItemModel = PrismaModelTypes & {
  Name: 'Item';
  OrderBy: { id?: 'asc' | 'desc'; value?: 'asc' | 'desc' };
  ListRelations: never;
  RelationName: never;
};

function createBuilder() {
  return new SchemaBuilder<{ PrismaTypes: { Item: ItemModel } }>({
    plugins: [PrismaUtils],
    prisma: {
      client: {} as never,
      dmmf: { datamodel: { models: [] } } as never,
    },
  });
}

function inputFields(builder: ReturnType<typeof createBuilder>, name: string) {
  return (builder.toSchema().getType(name) as GraphQLInputObjectType).getFields();
}

describe('prismaOrderBy', () => {
  it('omits fields that are explicitly disabled with false', () => {
    const builder = createBuilder();
    const OrderBy = builder.prismaOrderBy('Item', { fields: { id: true, value: false } });

    builder.queryType({
      fields: (t) => ({
        hello: t.string({ args: { order: t.arg({ type: OrderBy }) }, resolve: () => '' }),
      }),
    });

    expect(Object.keys(inputFields(builder, 'ItemOrderBy'))).toEqual(['id']);
  });
});
