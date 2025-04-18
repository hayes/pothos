import { printSchema } from 'graphql';
import { schema } from './example/schema';
import { schema as postgresSchema } from './postgres/schema';

describe('drizzle plugin', () => {
  it('produces the expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });

  it('produces the expected postgres schema', () => {
    expect(printSchema(postgresSchema)).toMatchSnapshot();
  });
});
