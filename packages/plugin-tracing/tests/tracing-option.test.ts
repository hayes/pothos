import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import TracingPlugin from '../src';

function createBuilder(traced: string[]) {
  return new SchemaBuilder<{ Tracing: boolean | null }>({
    plugins: [TracingPlugin],
    tracing: {
      default: true,
      wrap: (resolve, _options, config) => {
        traced.push(config.name);

        return resolve;
      },
    },
  });
}

describe('field tracing option', () => {
  it('static null disables tracing just like a callback returning null', async () => {
    const traced: string[] = [];
    const builder = createBuilder(traced);

    builder.queryType({
      fields: (t) => ({
        static: t.string({ tracing: null, resolve: () => '' }),
        dynamic: t.string({ tracing: () => null, resolve: () => '' }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ static dynamic }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(traced).toEqual([]);
  });

  it('uses the default when a field does not set tracing', async () => {
    const traced: string[] = [];
    const builder = createBuilder(traced);

    builder.queryType({
      fields: (t) => ({
        inherited: t.string({ resolve: () => '' }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ inherited }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(traced).toEqual(['inherited']);
  });
});
