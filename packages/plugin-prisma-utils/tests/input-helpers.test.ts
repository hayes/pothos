import SchemaBuilder from '@pothos/core';
import type { PrismaModelTypes } from '@pothos/plugin-prisma';
import { type GraphQLInputObjectType, graphql } from 'graphql';
import { describe, expect, expectTypeOf, it } from 'vitest';
import PrismaUtils from '../src';

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

  it('uses the order enum for scalar option callbacks that omit a type', () => {
    const builder = createBuilder();
    const OrderBy = builder.prismaOrderBy('Item', {
      fields: { id: () => ({ description: 'Sort ID' }) },
    });

    builder.queryType({
      fields: (t) => ({
        hello: t.string({ args: { order: t.arg({ type: OrderBy }) }, resolve: () => '' }),
      }),
    });

    const field = inputFields(builder, 'ItemOrderBy').id;

    expect(field.type.toString()).toBe('OrderBy');
    expect(field.description).toBe('Sort ID');
  });
});

describe('prismaListFilter', () => {
  it('types operations as optional because they are optional at runtime', async () => {
    const builder = createBuilder();
    const ItemWhere = builder.inputType('ItemWhere', { fields: (t) => ({ id: t.int() }) });
    const ItemListFilter = builder.prismaListFilter(ItemWhere, { ops: ['some'] });

    builder.queryType({
      fields: (t) => ({
        hello: t.int({
          args: { filter: t.arg({ type: ItemListFilter, required: true }) },
          resolve: (_parent, args) => {
            expectTypeOf(args.filter.some).toEqualTypeOf<{ id?: number | null } | undefined>();
            expect(args.filter.some).toBeUndefined();

            return args.filter.some?.id ?? 0;
          },
        }),
      }),
    });

    await expect(
      graphql({ schema: builder.toSchema(), source: '{ hello(filter: {}) }' }),
    ).resolves.toEqual({ data: { hello: 0 } });
  });

  it('infers operation names from a readonly ops tuple', () => {
    const builder = createBuilder();
    const ItemWhere = builder.inputType('ItemWhere', { fields: (t) => ({ id: t.int() }) });
    const ItemListFilter = builder.prismaListFilter(ItemWhere, { ops: ['some', 'none'] as const });

    builder.queryType({
      fields: (t) => ({
        hello: t.int({
          args: { filter: t.arg({ type: ItemListFilter, required: true }) },
          resolve: (_parent, args) => args.filter.some?.id ?? args.filter.none?.id ?? 0,
        }),
      }),
    });

    expect(Object.keys(inputFields(builder, 'ListItemWhere')).sort()).toEqual(['none', 'some']);
  });
});
