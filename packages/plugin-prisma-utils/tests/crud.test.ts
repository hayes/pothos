import { printSchema } from 'graphql';
import { queries } from './examples/codegen/builder';
import schema from './examples/crud/schema';

describe('generate crud', () => {
  afterEach(() => {
    queries.length = 0;
  });

  it('generates schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
