import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// A throw in the loader tick (building the query, `findUnique`, or the delegate call) used to
// abort the loop over the batch, leaving every model it had not reached pending forever: the
// request hung instead of erroring.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

// `findUnique: null` makes the loader's `findUnique` throw `Missing findUnique for ...`, which is
// the reachable misconfiguration: the throw happens inside the tick, once per staged model.
const User = builder.prismaObject('User', {
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    // Selects nothing from the parent row at runtime, so it is never answered from the planned
    // query and always falls back to the model loader.
    shout: t.string({
      nullable: true,
      select: () => null as unknown as { name: true },
      resolve: (user) => user.name?.toUpperCase(),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Two rows fetched without the planned selection: both stage into the same loader tick.
    rawUsers: t.field({
      type: [User],
      resolve: () =>
        prisma.user.findMany({ where: { id: { in: [1, 2] } }, orderBy: { id: 'asc' } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('model loader errors', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Timed out so a regression fails fast rather than stalling the suite: the bug this covers
  // hangs the request forever.
  it('rejects every model staged in a tick when the loader throws', { timeout: 5000 }, async () => {
    const result = await execute({
      schema,
      document: gql`
          query {
            rawUsers {
              shout
            }
          }
        `,
      contextValue: {},
    });

    // Both rows staged in the same tick error; neither hangs.
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Missing findUnique for User',
      'Missing findUnique for User',
    ]);
    expect(result.data).toEqual({ rawUsers: [{ shout: null }, { shout: null }] });
  });

  it('does not leave an unhandled rejection behind', { timeout: 5000 }, async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => unhandled.push(error);
    process.on('unhandledRejection', onUnhandled);

    try {
      await execute({
        schema,
        document: gql`
            query {
              rawUsers {
                shout
              }
            }
          `,
        contextValue: {},
      });

      // A rejection is reported at the end of the turn it went unhandled in.
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    expect(unhandled).toEqual([]);
  });
});
