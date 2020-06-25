import { printSchema, lexicographicSortSchema } from 'graphql';
import exampleSchema from './examples/random-stuff';

describe('Example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });
});
