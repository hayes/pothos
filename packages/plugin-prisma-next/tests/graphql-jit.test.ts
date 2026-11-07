import type { GraphQLFieldResolver, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { detailOf } from './fixtures/errors';
import { createBuilder, globalId, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

function schema() {
  const builder = createBuilder();
  builder.prismaNode('User', {
    id: { field: 'id' },
    fields: (t) => ({ firstName: t.exposeString('firstName') }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({ type: ['User'], collection: () => db.orm.User }),
    }),
  });
  return builder.toSchema();
}

/** Passes the query's fields a path as graphql-jit builds it, without a `typename`. */
function asGraphQLJit(schema: GraphQLSchema) {
  const fields = (schema.getQueryType() as GraphQLObjectType).getFields();
  for (const field of Object.values(fields)) {
    const resolve = field.resolve as GraphQLFieldResolver<unknown, unknown>;
    field.resolve = (parent, args, context, info) =>
      resolve(parent, args, context, {
        ...info,
        path: { prev: info.path.prev, key: info.path.key } as never,
      });
  }
  return schema;
}

describe('graphql-jit', () => {
  it.each([
    ['a prisma field', '{ users { firstName } }', undefined],
    [
      'node',
      'query ($id: ID!) { node(id: $id) { ... on User { firstName } } }',
      { id: globalId('User', 'u-bob') },
    ],
  ])('fails %s closed', async (_name, source, variables) => {
    const result = await run(asGraphQLJit(schema()), source, { variables });
    expect(result.errors).toHaveLength(1);
    expect(detailOf(result.errors?.[0])).toMatch(/graphql-jit/);
    expect(result.statements).toHaveLength(0);
  });
});
