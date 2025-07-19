import { printSchema } from 'graphql';
import { schema } from './examples/dcc/schema';

describe('dcc schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
