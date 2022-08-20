import { printSchema } from 'graphql';
import schema from './examples/crud/schema';
import { prisma } from './examples/simple/builder';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('generate crud', () => {
  afterEach(() => {
    queries = [];
  });

  it('generates schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
