import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient, queryFromInfo } from '../src';
import { prisma, queries } from './example/builder';
import schema from './example/schema';
import { getDatamodel } from './generated.js';

// A schema where a prisma-backed field only exists on one implementation of an interface, so it
// can only be selected behind an inline fragment or fragment spread.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number } };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts'),
  }),
});

const Profile = builder.prismaObject('Profile', {
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.exposeString('bio', { nullable: true }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

interface EntryShape {
  kind: string;
  user?: { id: number };
}

const Entry = builder.interfaceRef<EntryShape>('Entry').implement({
  fields: (t) => ({
    kind: t.exposeString('kind'),
  }),
  resolveType: (entry) => (entry.user ? 'AppointmentEntry' : 'OtherEntry'),
});

const HasAppointment = builder.interfaceRef<EntryShape>('HasAppointment').implement({
  fields: (t) => ({
    appointment: t.field({
      type: User,
      resolve: (entry) => entry.user as never,
    }),
  }),
});

builder.objectRef<EntryShape>('AppointmentEntry').implement({
  interfaces: [Entry, HasAppointment],
});

builder.objectRef<EntryShape>('OtherEntry').implement({
  interfaces: [Entry],
  fields: (t) => ({
    // Same field name as AppointmentEntry.appointment, but a different prisma model
    appointment: t.field({
      type: Profile,
      resolve: () => ({ id: 1, bio: 'other' }) as never,
    }),
  }),
});

async function resolveEntries(
  context: object,
  info: Parameters<typeof queryFromInfo>[0]['info'],
  path: (string | { name: string; type?: string })[],
) {
  const user = await prisma.user.findUniqueOrThrow({
    ...queryFromInfo({ context, info, typeName: 'User', path }),
    where: { id: 1 },
  });

  return [{ kind: 'appointment', user }, { kind: 'other' }];
}

builder.queryType({
  fields: (t) => ({
    entries: t.field({
      type: [Entry],
      resolve: (_root, _args, context, info) => resolveEntries(context, info, ['appointment']),
    }),
    entriesWithTypedPath: t.field({
      type: [Entry],
      resolve: (_root, _args, context, info) =>
        resolveEntries(context, info, [{ name: 'appointment', type: 'AppointmentEntry' }]),
    }),
  }),
});

const entriesSchema = builder.toSchema();

const expectedData = {
  entries: [
    {
      kind: 'appointment',
      appointment: { id: '1', posts: expect.arrayContaining([{ id: expect.any(String) }]) },
    },
    { kind: 'other' },
  ],
};

describe('indirect include paths through fragments', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('queryFromInfo path into a field behind a narrowing fragment', () => {
    it('resolves the field through an inline fragment on an implementing type', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries {
              kind
              ... on AppointmentEntry {
                appointment {
                  id
                  posts {
                    id
                  }
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedData);
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { include: { posts: true }, where: { id: 1 } },
        },
      ]);
    });

    it('resolves the field through a fragment spread on an implementing type', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries {
              kind
              ...AppointmentFields
            }
          }

          fragment AppointmentFields on AppointmentEntry {
            appointment {
              id
              posts {
                id
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedData);
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { include: { posts: true }, where: { id: 1 } },
        },
      ]);
    });

    it('resolves the field when a narrowing fragment is followed by a widening one', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries {
              kind
              ... on AppointmentEntry {
                ... on HasAppointment {
                  appointment {
                    id
                    posts {
                      id
                    }
                  }
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedData);
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { include: { posts: true }, where: { id: 1 } },
        },
      ]);
    });

    it('accepts { name, type } segments to pin the fragment type', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries: entriesWithTypedPath {
              kind
              ... on AppointmentEntry {
                appointment {
                  id
                  posts {
                    id
                  }
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedData);
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { include: { posts: true }, where: { id: 1 } },
        },
      ]);
    });
  });

  describe('same field name on multiple implementations', () => {
    it('skips matches whose field returns a different prisma model', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries {
              kind
              ... on OtherEntry {
                appointment {
                  id
                  bio
                }
              }
              ... on AppointmentEntry {
                appointment {
                  id
                  posts {
                    id
                  }
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        entries: [
          expectedData.entries[0],
          { kind: 'other', appointment: { id: '1', bio: 'other' } },
        ],
      });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { include: { posts: true }, where: { id: 1 } },
        },
      ]);
    });
  });

  describe('nestedSelection path into a field selected through a fragment', () => {
    const expectedQuery = {
      action: 'findUniqueOrThrow',
      model: 'User',
      args: {
        select: {
          id: true,
          posts: { take: 2, select: { id: true, title: true } },
        },
        where: { id: 1 },
      },
    };

    it('selects the nested field directly', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              postPreviews {
                post {
                  id
                  title
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(queries).toEqual([expectedQuery]);
    });

    it('selects the nested field through an inline fragment on the same type', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              postPreviews {
                ... on PostPreview {
                  post {
                    id
                    title
                  }
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(queries).toEqual([expectedQuery]);
    });

    it('selects the nested field through a fragment spread on the same type', async () => {
      const result = await execute({
        schema,
        document: gql`
          query {
            viewer {
              postPreviews {
                ...PreviewFields
              }
            }
          }

          fragment PreviewFields on PostPreview {
            post {
              id
              title
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(queries).toEqual([expectedQuery]);
    });
  });
});
