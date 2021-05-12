import { lexicographicSortSchema, printSchema } from 'graphql';
import pluginSchema from './examples/test-plugin';

describe('plugin example', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(pluginSchema))).toMatchSnapshot();
  });
});
