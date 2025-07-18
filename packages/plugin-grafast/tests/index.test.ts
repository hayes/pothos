import { printSchema } from 'graphql';
import { schema } from './example/builder';

describe('grafast', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
