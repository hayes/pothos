import SchemaBuilder from '@pothos/core';
import { expect, it } from 'vitest';
import PrismaNextPlugin from '../src';
import { run, sampleContract, sampleDdl, useDatabase } from './fixtures/helpers';

const namespace = sampleContract.domain.namespaces.__unbound__;
const contract = {
  ...sampleContract,
  domain: {
    ...sampleContract.domain,
    namespaces: {
      __unbound__: {
        ...namespace,
        models: {
          ...namespace.models,
          User: {
            ...namespace.models.User,
            relations: {
              ...namespace.models.User.relations,
              peers: {
                cardinality: '1:N',
                on: { localFields: ['id'], targetFields: ['id'] },
                to: namespace.models.Post.relations.author.to,
              } as const,
            },
          },
        },
      },
    },
  },
};
const db = useDatabase(contract, sampleDdl);

it('builds aggregate reducers in the include scope where they execute', async () => {
  const builder = new SchemaBuilder<{ PrismaContract: typeof contract }>({
    plugins: [PrismaNextPlugin],
    prisma: { client: db.client },
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      peers: t.relation('peers'),
      selfCount: t.int({
        select: { peers: (peers) => ({ selfCount: peers.count() }) },
        resolve: (user) => user.selfCount,
      }),
    }),
  });
  builder.queryType({ fields: (t) => ({ users: t.prismaField({ type: ['User'] }) }) });
  const result = await run(
    builder.toSchema(),
    '{ users { selfCount peers { selfCount peers { selfCount } } } }',
  );
  expect(result.errors).toBeUndefined();
  expect(result.data.users).toEqual([
    { selfCount: 1, peers: [{ selfCount: 1, peers: [{ selfCount: 1 }] }] },
    { selfCount: 1, peers: [{ selfCount: 1, peers: [{ selfCount: 1 }] }] },
  ]);
  expect(result.statements).toHaveLength(1);
});
