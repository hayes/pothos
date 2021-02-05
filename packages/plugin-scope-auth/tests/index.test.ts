import { printSchema, lexicographicSortSchema } from 'graphql';

import exampleSchema from './example/schema';

describe('example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });
});
