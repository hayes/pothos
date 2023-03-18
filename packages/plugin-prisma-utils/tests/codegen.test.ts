import { printSchema } from 'graphql';
import { prisma } from './examples/codegen/builder';
import schema from './examples/codegen/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('codegen', () => {
  afterEach(() => {
    queries = [];
  });

  it('generates schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});
