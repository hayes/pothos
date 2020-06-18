import { printSchema, lexicographicSortSchema } from 'graphql';
import exampleSchema from './examples/relay/schema';

describe('relay example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });

  // describe('queries', () => {});
});
