import { lexicographicSortSchema, printSchema } from 'graphql';
import { schema } from './example/schema';

describe('example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(schema))).toMatchSnapshot();
  });
});
