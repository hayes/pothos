import SchemaBuilder from '@pothos/core';
import type { GraphQLObjectType } from 'graphql';
import ErrorPlugin from '../src';

describe('generated type defaults', () => {
  it('applies default result fields and default union extensions', () => {
    const builder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [Error],
        defaultResultOptions: {
          fields: (t) => ({
            marker: t.boolean({ resolve: () => true }),
          }),
        },
        defaultUnionOptions: {
          extensions: { marker: 'preserved' },
        },
      },
    });

    builder.objectType(Error, {
      name: 'BaseError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        value: t.int({
          errors: {},
          resolve: () => 1,
        }),
      }),
    });

    const schema = builder.toSchema();

    expect(
      (schema.getType('QueryValueSuccess') as GraphQLObjectType).getFields().marker,
    ).toBeDefined();
    expect(schema.getType('QueryValueResult')?.extensions.marker).toBe('preserved');
  });

  it('applies default item result fields and default item union extensions', () => {
    const builder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [Error],
        defaultItemResultOptions: {
          fields: (t) => ({
            marker: t.boolean({ resolve: () => true }),
          }),
        },
        defaultItemUnionOptions: {
          extensions: { marker: 'preserved' },
        },
      },
    });

    builder.objectType(Error, {
      name: 'BaseError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        values: t.intList({
          itemErrors: {},
          resolve: () => [1],
        }),
      }),
    });

    const schema = builder.toSchema();

    expect(
      (schema.getType('QueryValuesItemSuccess') as GraphQLObjectType).getFields().marker,
    ).toBeDefined();
    expect(schema.getType('QueryValuesItemResult')?.extensions.marker).toBe('preserved');
  });

  it('lets field level options override the defaults', () => {
    const builder = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin],
      errors: {
        defaultTypes: [Error],
        defaultResultOptions: {
          description: 'default description',
          fields: (t) => ({
            marker: t.boolean({ resolve: () => true }),
          }),
        },
        defaultUnionOptions: {
          extensions: { marker: 'preserved', overridden: 'default' },
        },
      },
    });

    builder.objectType(Error, {
      name: 'BaseError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        value: t.int({
          errors: {
            result: {
              description: 'field description',
              fields: (t) => ({
                fieldMarker: t.boolean({ resolve: () => true }),
              }),
            },
            union: {
              extensions: { overridden: 'field' },
            },
          },
          resolve: () => 1,
        }),
      }),
    });

    const schema = builder.toSchema();
    const successType = schema.getType('QueryValueSuccess') as GraphQLObjectType;

    expect(successType.description).toBe('field description');
    expect(successType.getFields().marker).toBeDefined();
    expect(successType.getFields().fieldMarker).toBeDefined();
    expect(schema.getType('QueryValueResult')?.extensions.marker).toBe('preserved');
    expect(schema.getType('QueryValueResult')?.extensions.overridden).toBe('field');
  });
});
