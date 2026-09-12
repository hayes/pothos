import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import ErrorPlugin from '../src';

describe('promised list items', () => {
  function createBuilder() {
    const builder = new SchemaBuilder<{}>({ plugins: [ErrorPlugin] });

    builder.objectType(Error, {
      name: 'BaseError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    return builder;
  }

  it('wraps a synchronous declared Error in an explicit error union list', async () => {
    const builder = createBuilder();
    const Success = builder.objectRef<{ value: number }>('Success').implement({
      isTypeOf: (value) => typeof value === 'object' && value !== null && 'value' in value,
      fields: (t) => ({
        value: t.exposeInt('value'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        results: t.errorUnionListField({
          types: [Success, Error],
          resolve: () => [{ value: 1 }, new Error('expected')],
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ results { __typename ... on BaseError { message } ... on Success { value } } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      results: [
        { __typename: 'Success', value: 1 },
        { __typename: 'BaseError', message: 'expected' },
      ],
    });
  });

  it.each([
    'fulfilled',
    'rejected',
  ] as const)('wraps a %s Error promise in an explicit error union list', async (mode) => {
    const builder = createBuilder();
    const Success = builder.objectRef<{ value: number }>('Success').implement({
      isTypeOf: (value) => typeof value === 'object' && value !== null && 'value' in value,
      fields: (t) => ({
        value: t.exposeInt('value'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        results: t.errorUnionListField({
          types: [Success, Error],
          resolve: () => [
            Promise.resolve({ value: 1 }),
            mode === 'fulfilled'
              ? Promise.resolve(new Error('expected'))
              : Promise.reject(new Error('expected')),
          ],
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ results { __typename ... on BaseError { message } ... on Success { value } } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      results: [
        { __typename: 'Success', value: 1 },
        { __typename: 'BaseError', message: 'expected' },
      ],
    });
  });

  it('wraps a rejected item promise for a scalar list with itemErrors', async () => {
    const builder = createBuilder();

    builder.queryType({
      fields: (t) => ({
        values: t.intList({
          itemErrors: { types: [Error] },
          resolve: () => [Promise.resolve(1), Promise.reject(new Error('expected'))],
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source:
        '{ values { __typename ... on BaseError { message } ... on QueryValuesItemSuccess { data } } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      values: [
        { __typename: 'QueryValuesItemSuccess', data: 1 },
        { __typename: 'BaseError', message: 'expected' },
      ],
    });
  });

  it('rethrows rejected item promises that do not match a declared error', async () => {
    const builder = createBuilder();

    class CustomError extends Error {}

    builder.objectType(CustomError, {
      name: 'CustomError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        values: t.intList({
          itemErrors: { types: [CustomError] },
          resolve: () => [Promise.resolve(1), Promise.reject(new Error('unmatched'))],
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source:
        '{ values { __typename ... on CustomError { message } ... on QueryValuesItemSuccess { data } } }',
      contextValue: {},
    });

    expect(result.errors?.[0]?.message).toBe('unmatched');
  });
});

describe('nested list items', () => {
  function createNestedBuilder(
    resolve: () => unknown[],
  ): PothosSchemaTypes.SchemaBuilder<PothosSchemaTypes.ExtendDefaultTypes<{}>> {
    const builder = new SchemaBuilder<{}>({ plugins: [ErrorPlugin] });

    builder.objectType(Error, {
      name: 'BaseError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        values: t.field({
          type: [['Int']],
          nullable: { list: true, items: { list: true, items: true } },
          itemErrors: { types: [Error] },
          resolve,
        } as never),
      }),
    });

    return builder;
  }

  const source =
    '{ values { __typename ... on BaseError { message } ... on QueryValuesItemSuccess { data } } }';

  it('reports errors thrown for inner list items', async () => {
    const builder = createNestedBuilder(() => [[1, new Error('inner-sync')]]);

    const result = await graphql({ schema: builder.toSchema(), source, contextValue: {} });

    expect(result.errors?.map((error) => error.message)).toEqual(['inner-sync']);
    expect(result.data).toEqual({
      values: [{ __typename: 'QueryValuesItemSuccess', data: [1, null] }],
    });
  });

  it('reports rejections for inner list items', async () => {
    const builder = createNestedBuilder(() => [[1, Promise.reject(new Error('inner-async'))]]);

    const result = await graphql({ schema: builder.toSchema(), source, contextValue: {} });

    expect(result.errors?.map((error) => error.message)).toEqual(['inner-async']);
    expect(result.data).toEqual({
      values: [{ __typename: 'QueryValuesItemSuccess', data: [1, null] }],
    });
  });

  it('still wraps declared errors at the item level of a nested list', async () => {
    const builder = createNestedBuilder(() => [
      [1, 2],
      new Error('outer'),
      Promise.reject(new Error('outer-async')),
    ]);

    const result = await graphql({ schema: builder.toSchema(), source, contextValue: {} });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      values: [
        { __typename: 'QueryValuesItemSuccess', data: [1, 2] },
        { __typename: 'BaseError', message: 'outer' },
        { __typename: 'BaseError', message: 'outer-async' },
      ],
    });
  });

  function createNestedUnionBuilder(resolve: () => unknown[]) {
    const builder = new SchemaBuilder<{}>({ plugins: [ErrorPlugin] });

    builder.objectType(Error, {
      name: 'BaseError',
      fields: (t) => ({
        message: t.exposeString('message'),
      }),
    });

    const Item = builder.objectRef<{ value: number }>('Item').implement({
      isTypeOf: (value) => typeof value === 'object' && value !== null && 'value' in value,
      fields: (t) => ({
        value: t.exposeInt('value'),
      }),
    });

    const ItemResult = builder.errorUnion('ItemResult', { types: [Item, Error] });

    builder.queryType({
      fields: (t) => ({
        rows: t.field({
          type: t.listRef(t.listRef(ItemResult)),
          resolve: resolve as never,
        }),
      }),
    });

    return builder;
  }

  const rowsSource = '{ rows { __typename ... on BaseError { message } ... on Item { value } } }';

  it('wraps declared errors at the level the error union covers', async () => {
    const builder = createNestedUnionBuilder(() => [
      [{ value: 1 }, new Error('inner'), Promise.reject(new Error('inner-async'))],
    ]);

    const result = await graphql({
      schema: builder.toSchema(),
      source: rowsSource,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      rows: [
        [
          { __typename: 'Item', value: 1 },
          { __typename: 'BaseError', message: 'inner' },
          { __typename: 'BaseError', message: 'inner-async' },
        ],
      ],
    });
  });

  it('reports rejections above the level the error union covers', async () => {
    const builder = createNestedUnionBuilder(() => [
      [{ value: 1 }],
      Promise.reject(new Error('row-async')),
    ]);

    const result = await graphql({
      schema: builder.toSchema(),
      source: rowsSource,
      contextValue: {},
    });

    expect(result.errors?.map((error) => error.message)).toEqual(['row-async']);
  });
});
