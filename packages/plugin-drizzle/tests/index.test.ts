import { printSchema } from 'graphql';
import { schema } from './example/schema';

describe('drizzle plugin', () => {
  it('produces the expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
