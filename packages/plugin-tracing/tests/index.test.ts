import { lexicographicSortSchema, printSchema } from 'graphql';
import exampleSchema from './example/schema';

describe('example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });
});
