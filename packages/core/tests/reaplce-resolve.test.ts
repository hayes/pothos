import { execute, lexicographicSortSchema, parse, printSchema } from 'graphql';
import pluginSchema from './examples/replace-resolve';

describe('replace-resolve plugin example', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(pluginSchema))).toMatchSnapshot();
  });

  it('resolves hello', async () => {
    const result = await execute({
      schema: pluginSchema,
      document: parse(/* GraphQL */ `
        query {
          hello
        }
      `),
    });

    expect(result).toEqual({
      data: {
        hello: 'world',
      },
    });
  });
});
