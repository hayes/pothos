import type { PlaygroundExample } from '../types';

export const unionsExample: PlaygroundExample = {
  id: 'unions',
  title: 'Union Types',
  description: 'Define union types for polymorphic results',
  files: [
    {
      filename: 'schema.ts',
      content: `import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define result types
const SuccessResult = builder.objectRef<{
  __typename: 'SuccessResult';
  message: string;
}>('SuccessResult');

const ErrorResult = builder.objectRef<{
  __typename: 'ErrorResult';
  error: string;
  code: number;
}>('ErrorResult');

builder.objectType(SuccessResult, {
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

builder.objectType(ErrorResult, {
  fields: (t) => ({
    error: t.exposeString('error'),
    code: t.exposeInt('code'),
  }),
});

// Create a union type
const Result = builder.unionType('Result', {
  types: [SuccessResult, ErrorResult],
  resolveType: (value) => {
    if (value.__typename === 'SuccessResult') {
      return SuccessResult;
    }
    return ErrorResult;
  },
});

builder.queryType({
  fields: (t) => ({
    doSomething: t.field({
      type: Result,
      args: {
        shouldSucceed: t.arg.boolean({ required: true }),
      },
      resolve: (_, args) => {
        if (args.shouldSucceed) {
          return {
            __typename: 'SuccessResult' as const,
            message: 'Operation completed successfully!',
          };
        }
        return {
          __typename: 'ErrorResult' as const,
          error: 'Something went wrong',
          code: 500,
        };
      },
    }),
  }),
});

export const schema = builder.toSchema();`,
    },
  ],
  defaultQuery: `query {
  success: doSomething(shouldSucceed: true) {
    ... on SuccessResult {
      message
    }
    ... on ErrorResult {
      error
      code
    }
  }
  failure: doSomething(shouldSucceed: false) {
    ... on SuccessResult {
      message
    }
    ... on ErrorResult {
      error
      code
    }
  }
}`,
};
