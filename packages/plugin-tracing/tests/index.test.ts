import { printSchema } from 'graphql';
import { schema } from './example/schema';

describe('example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
