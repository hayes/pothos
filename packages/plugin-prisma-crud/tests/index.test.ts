import { printSchema } from 'graphql';
import schema from './example/schema';

describe('prisma crud', () => {
  it('generates schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
