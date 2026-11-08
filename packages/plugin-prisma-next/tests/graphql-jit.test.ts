import { rebuildResolverPaths } from '@pothos/test-utils';
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

describe('graphql-jit', () => {
  it.each([
    ['a prisma field', '{ users { firstName } }', undefined],
    [
      'node',
      'query ($id: ID!) { node(id: $id) { ... on User { firstName } } }',
      { id: globalId('User', 'u-bob') },
    ],
  ])('fails %s closed', async (_name, source, variables) => {
    const built = schema();
    rebuildResolverPaths(built, () => true);
    const result = await run(built, source, { variables });
    expect(result.errors).toHaveLength(1);
    expect(detailOf(result.errors?.[0])).toMatch(/graphql-jit/);
    expect(result.statements).toHaveLength(0);
  });
});
