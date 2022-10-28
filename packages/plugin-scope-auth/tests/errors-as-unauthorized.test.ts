import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import schema from './example/errorsAsUnauthorized';

class Counter {
  counts = new Map<string, number>();

  count = (name: string) => {
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
  };
}

describe('treatErrorsAsUnauthorized', () => {
  it('rejects errors as expected', async () => {
    const query = gql`
      query {
        syncPermission
        asyncPermission
        any
        all
        inlineSync
        inlineAsync
      }
    `;

    const counter = new Counter();

    const result = await execute({
      schema,
      document: query,
      contextValue: {
        throwInScope: true,
        count: counter.count,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "all": null,
          "any": null,
          "asyncPermission": null,
          "inlineAsync": null,
          "inlineSync": null,
          "syncPermission": null,
        },
        "errors": [
          [GraphQLError: Not authorized to resolve Query.syncPermission],
          [GraphQLError: Not authorized to resolve Query.all],
          [GraphQLError: inlineSync],
          [GraphQLError: inlineAsync],
          [GraphQLError: Not authorized to resolve Query.asyncPermission],
          [GraphQLError: Not authorized to resolve Query.any],
        ],
      }
    `);
  });

  it('without error', async () => {
    const query = gql`
      query {
        syncPermission
        asyncPermission
        any
        all
        inlineSync
        inlineAsync
      }
    `;

    const counter = new Counter();

    const result = await execute({
      schema,
      document: query,
      contextValue: {
        throwInScope: false,
        count: counter.count,
        throwFirst: true,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "all": null,
          "any": null,
          "asyncPermission": null,
          "inlineAsync": null,
          "inlineSync": null,
          "syncPermission": null,
        },
        "errors": [
          [GraphQLError: Not authorized to resolve Query.syncPermission],
          [GraphQLError: Not authorized to resolve Query.all],
          [GraphQLError: inlineSync],
          [GraphQLError: inlineAsync],
          [GraphQLError: Not authorized to resolve Query.asyncPermission],
          [GraphQLError: Not authorized to resolve Query.any],
        ],
      }
    `);
  });

  it('throw first in any and all', async () => {
    const query = gql`
      query {
        syncPermission
        asyncPermission
        any
        all
        inlineSync
        inlineAsync
      }
    `;

    const counter = new Counter();

    const result = await execute({
      schema,
      document: query,
      contextValue: {
        throwInScope: true,
        count: counter.count,
        throwFirst: true,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "all": null,
          "any": null,
          "asyncPermission": null,
          "inlineAsync": null,
          "inlineSync": null,
          "syncPermission": null,
        },
        "errors": [
          [GraphQLError: syncPermission],
          [GraphQLError: syncPermission],
          [GraphQLError: inlineSync],
          [GraphQLError: inlineAsync],
          [GraphQLError: asyncPermission],
          [GraphQLError: syncPermission],
        ],
      }
    `);
  });
});
