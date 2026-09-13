import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import ErrorsPlugin from '../src';

it.each([
  'extensible',
  'sealed',
  'frozen',
  'fixed-method',
] as const)('reads private state through getters on %s errors', async (mode) => {
  class PrivateError extends Error {
    #code = 'PRIVATE';
    readCode() {
      return this.#code;
    }
    get code() {
      return this.#code;
    }
  }
  const error = new PrivateError('original message');
  if (mode === 'fixed-method') {
    Object.defineProperty(error, 'readCode', {
      value: error.readCode,
      configurable: false,
      writable: false,
    });
  } else if (mode === 'sealed') {
    Object.seal(error);
  } else if (mode === 'frozen') {
    Object.freeze(error);
  }
  const builder = new SchemaBuilder({ plugins: [ErrorsPlugin] });
  builder.objectType(PrivateError, {
    name: 'PrivateError',
    fields: (t) => ({
      code: t.exposeString('code'),
      method: t.string({ resolve: (value) => value.readCode() }),
      stableMethod: t.boolean({
        resolve: (value) => {
          const method = value.readCode;
          return method === value.readCode;
        },
      }),
      constructorMatches: t.boolean({ resolve: (value) => value.constructor === PrivateError }),
      text: t.string({ resolve: (value) => value.toString() }),
      message: t.exposeString('message'),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      failure: t.string({
        errors: { types: [PrivateError] },
        resolve: () => {
          throw error;
        },
      }),
    }),
  });
  const result = await graphql({
    schema: builder.toSchema(),
    source:
      '{ failure { ... on PrivateError { code method stableMethod constructorMatches text message } } }',
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    failure: {
      code: 'PRIVATE',
      method: 'PRIVATE',
      stableMethod: true,
      constructorMatches: true,
      text: 'Error: original message',
      message: 'original message',
    },
  });
});
