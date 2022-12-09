import { lexicographicSortSchema, printSchema } from 'graphql';
import exampleSchema from './examples/simple/schema';

describe('simple objects example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });
});
