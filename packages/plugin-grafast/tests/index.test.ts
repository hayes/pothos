import { printSchema } from 'graphql';
import { schema } from './examples/basic/schema';

describe('grafast', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
