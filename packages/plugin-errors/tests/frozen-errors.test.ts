import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import ErrorPlugin from '../src';

describe('frozen errors', () => {
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

  it('wraps a thrown frozen declared error', async () => {
    const builder = createBuilder();

    builder.queryType({
      fields: (t) => ({
        value: t.int({
          errors: { types: [Error] },
          resolve: () => {
            throw Object.freeze(new Error('bad'));
          },
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ value { __typename ... on BaseError { message } } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ value: { __typename: 'BaseError', message: 'bad' } });
  });

  it('wraps a thrown non-extensible declared error subclass', async () => {
    const builder = createBuilder();

    class CustomError extends Error {
      code: string;

      constructor(message: string, code: string) {
        super(message);
        this.code = code;
      }
    }

    builder.objectType(CustomError, {
      name: 'CustomError',
      isTypeOf: (value) => value instanceof CustomError,
      fields: (t) => ({
        message: t.exposeString('message'),
        code: t.exposeString('code'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        value: t.int({
          errors: { types: [CustomError] },
          resolve: () => {
            throw Object.preventExtensions(new CustomError('bad', 'CODE'));
          },
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ value { __typename ... on CustomError { message code } } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      value: { __typename: 'CustomError', message: 'bad', code: 'CODE' },
    });
  });

  it('wraps a frozen declared error returned as a list item', async () => {
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
          resolve: () => [{ value: 1 }, Object.freeze(new Error('bad'))],
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
        { __typename: 'BaseError', message: 'bad' },
      ],
    });
  });
});
