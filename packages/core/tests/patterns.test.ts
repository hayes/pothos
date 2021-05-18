import { lexicographicSortSchema, printSchema } from 'graphql';
import schema from './examples/patterns/schema';

describe('patterns example', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(schema))).toMatchSnapshot();
  });
});
