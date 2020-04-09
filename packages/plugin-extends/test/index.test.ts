import { printSchema, lexicographicSortSchema } from 'graphql';
import exampleSchema from './examples/extends/schema';

describe('extends example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });

  // describe('queries', () => {});
});
