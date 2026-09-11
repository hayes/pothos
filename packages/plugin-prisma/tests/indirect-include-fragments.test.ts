import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient, queryFromInfo } from '../src';
import type { Post as PostRow, Profile as ProfileRow, User as UserRow } from './client/client.js';
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
    profile: t.relation('profile', { nullable: true }),
  }),
});

const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    profile: t.relation('profile', { nullable: true }),
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

interface AppointmentEntryShape {
  kind: 'appointment';
  user: UserRow;
}

interface OtherEntryShape {
  kind: 'other';
}

interface VariantEntryShape {
  kind: 'variant';
  user: UserRow;
}

type EntryShape = AppointmentEntryShape | OtherEntryShape | VariantEntryShape;

const Entry = builder.interfaceRef<EntryShape>('Entry').implement({
  fields: (t) => ({
    kind: t.exposeString('kind'),
  }),
  resolveType: (entry) => {
    switch (entry.kind) {
      case 'appointment':
        return 'AppointmentEntry';
      case 'variant':
        return 'VariantEntry';
      default:
        return 'OtherEntry';
    }
  },
});

const HasAppointment = builder.interfaceRef<AppointmentEntryShape>('HasAppointment').implement({
  fields: (t) => ({
    appointment: t.field({
      type: User,
      resolve: (entry) => entry.user,
    }),
  }),
});

const AppointmentEntry = builder.objectRef<AppointmentEntryShape>('AppointmentEntry').implement({
  interfaces: [Entry, HasAppointment],
});

// Same field name as AppointmentEntry.appointment, same prisma model, different variant
builder.objectRef<VariantEntryShape>('VariantEntry').implement({
  interfaces: [Entry],
  fields: (t) => ({
    appointment: t.field({
      type: Viewer,
      resolve: (entry) => entry.user,
    }),
  }),
});

const otherProfile: ProfileRow = { id: 1, bio: 'other', userId: 1 };

const OtherEntry = builder.objectRef<OtherEntryShape>('OtherEntry').implement({
  interfaces: [Entry],
  fields: (t) => ({
    // Same field name as AppointmentEntry.appointment, but a different prisma model
    appointment: t.field({
      type: Profile,
      resolve: () => otherProfile,
    }),
  }),
});

const EntryUnion = builder.unionType('EntryUnion', {
  types: [AppointmentEntry, OtherEntry],
  resolveType: (entry) => (entry.kind === 'appointment' ? 'AppointmentEntry' : 'OtherEntry'),
});

async function resolveEntries(
  context: object,
  info: Parameters<typeof queryFromInfo>[0]['info'],
  path: (string | { name: string; type?: string })[],
): Promise<(AppointmentEntryShape | OtherEntryShape)[]> {
  const user = await prisma.user.findUniqueOrThrow({
    ...queryFromInfo({ context, info, typeName: 'User', path }),
    where: { id: 1 },
  });

  return [{ kind: 'appointment', user }, { kind: 'other' }];
}

async function resolveEntriesWithVariant(
  context: object,
  info: Parameters<typeof queryFromInfo>[0]['info'],
  path: (string | { name: string; type?: string })[],
): Promise<EntryShape[]> {
  const entries = await resolveEntries(context, info, path);
  const user = (entries[0] as AppointmentEntryShape).user;

  return [...entries, { kind: 'variant', user }];
}

// A relation with field-level arguments next to a variant whose type-level select plans the same
// relation with other arguments: whichever fragment comes first, the type-level select wins and
// the field loads its own rows.
const LimitedUser = builder.prismaObject('User', {
  variant: 'LimitedUser',
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts', { query: { take: 2 } }),
  }),
});

const LimitedViewer = builder.prismaObject('User', {
  variant: 'LimitedViewer',
  select: { id: true, posts: { take: 5 } },
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const LimitedEntry = builder
  .interfaceRef<AppointmentEntryShape | VariantEntryShape>('LimitedEntry')
  .implement({
    fields: (t) => ({
      kind: t.exposeString('kind'),
    }),
    resolveType: (entry) =>
      entry.kind === 'appointment' ? 'LimitedAppointmentEntry' : 'LimitedVariantEntry',
  });

builder.objectRef<AppointmentEntryShape>('LimitedAppointmentEntry').implement({
  interfaces: [LimitedEntry],
  fields: (t) => ({
    appointment: t.field({
      type: LimitedUser,
      resolve: (entry) => entry.user,
    }),
  }),
});

builder.objectRef<VariantEntryShape>('LimitedVariantEntry').implement({
  interfaces: [LimitedEntry],
  fields: (t) => ({
    appointment: t.field({
      type: LimitedViewer,
      // The row was loaded by the walk that entered LimitedViewer, so it carries the posts the
      // variant's type-level select plans.
      resolve: (entry) => entry.user as UserRow & { posts: PostRow[] },
    }),
  }),
});

async function resolveLimitedEntries(
  context: object,
  info: Parameters<typeof queryFromInfo>[0]['info'],
): Promise<(AppointmentEntryShape | VariantEntryShape)[]> {
  const user = await prisma.user.findUniqueOrThrow({
    ...queryFromInfo({ context, info, typeName: 'LimitedUser', path: ['appointment'] }),
    where: { id: 1 },
  });

  return [
    { kind: 'appointment', user },
    { kind: 'variant', user },
  ];
}

builder.queryType({
  fields: (t) => ({
    limitedEntries: t.field({
      type: [LimitedEntry],
      resolve: (_root, _args, context, info) => resolveLimitedEntries(context, info),
    }),
    entries: t.field({
      type: [Entry],
      resolve: (_root, _args, context, info) => resolveEntries(context, info, ['appointment']),
    }),
    entriesWithTypedPath: t.field({
      type: [Entry],
      resolve: (_root, _args, context, info) =>
        resolveEntries(context, info, [{ name: 'appointment', type: 'AppointmentEntry' }]),
    }),
    entriesWithUnknownType: t.field({
      type: [Entry],
      resolve: (_root, _args, context, info) =>
        resolveEntries(context, info, [{ name: 'appointment', type: 'Nope' }]),
    }),
    entriesWithVariant: t.field({
      type: [Entry],
      resolve: (_root, _args, context, info) =>
        resolveEntriesWithVariant(context, info, ['appointment']),
    }),
    entriesWithVariantTypedPath: t.field({
      type: [Entry],
      resolve: (_root, _args, context, info) =>
        resolveEntriesWithVariant(context, info, [
          { name: 'appointment', type: 'AppointmentEntry' },
        ]),
    }),
    unionEntries: t.field({
      type: [EntryUnion],
      resolve: (_root, _args, context, info) => resolveEntries(context, info, ['appointment']),
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

  describe('fragments on overlapping abstract types', () => {
    it('resolves the field through a fragment on an interface that overlaps the list type', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries {
              kind
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

    it('resolves the field through a fragment on a union member', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries: unionEntries {
              ... on AppointmentEntry {
                kind
                appointment {
                  id
                  posts {
                    id
                  }
                }
              }
              ... on OtherEntry {
                kind
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

  describe('path segment validation', () => {
    it('reports an unknown segment type instead of crashing', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries: entriesWithUnknownType {
              kind
              ... on AppointmentEntry {
                appointment {
                  id
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors?.[0]?.message).toContain('Unknown type Nope');
    });
  });

  describe('multiple matches for the same segment', () => {
    it('merges selections from every fragment that selects the field', async () => {
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
              ...Extra
            }
          }

          fragment Extra on AppointmentEntry {
            appointment {
              profile {
                bio
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { include: { posts: true, profile: true }, where: { id: 1 } },
        },
      ]);
    });

    it('walks a variant of the target model with its own fields', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries: entriesWithVariant {
              kind
              ... on AppointmentEntry {
                appointment {
                  id
                  posts {
                    id
                  }
                }
              }
              ... on VariantEntry {
                appointment {
                  id
                  email
                  profile {
                    bio
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
          ...expectedData.entries,
          {
            kind: 'variant',
            appointment: { id: '1', email: expect.any(String), profile: expect.anything() },
          },
        ],
      });
      expect(queries).toEqual([
        {
          action: 'findUniqueOrThrow',
          model: 'User',
          args: { include: { posts: true, profile: true }, where: { id: 1 } },
        },
      ]);
    });

    it("settles a variant's type-level select before any match's field, whichever match comes first", async () => {
      const appointmentFirst = gql`
        query {
          entries: limitedEntries {
            kind
            ... on LimitedAppointmentEntry {
              appointment {
                id
                posts {
                  id
                }
              }
            }
            ... on LimitedVariantEntry {
              appointment {
                id
              }
            }
          }
        }
      `;
      const variantFirst = gql`
        query {
          entries: limitedEntries {
            kind
            ... on LimitedVariantEntry {
              appointment {
                id
              }
            }
            ... on LimitedAppointmentEntry {
              appointment {
                id
                posts {
                  id
                }
              }
            }
          }
        }
      `;
      const seen: unknown[][] = [];

      for (const document of [appointmentFirst, variantFirst]) {
        const result = await execute({
          schema: entriesSchema,
          document,
          contextValue: { user: { id: 1 } },
        });

        expect(result.errors).toBeUndefined();
        // LimitedUser.posts reads its own two rows, not the five the variant planned.
        expect(result.data).toEqual({
          entries: [
            {
              kind: 'appointment',
              appointment: {
                id: '1',
                posts: [{ id: expect.any(String) }, { id: expect.any(String) }],
              },
            },
            { kind: 'variant', appointment: { id: '1' } },
          ],
        });
        expect(queries).toHaveLength(2);
        seen.push([...queries]);
        queries.length = 0;
      }

      expect(seen[1]).toEqual(seen[0]);
      expect(seen[0]).toMatchInlineSnapshot(`
        [
          {
            "action": "findUniqueOrThrow",
            "args": {
              "include": {
                "posts": {
                  "take": 5,
                },
              },
              "where": {
                "id": 1,
              },
            },
            "model": "User",
          },
          {
            "action": "findUniqueOrThrow",
            "args": {
              "include": {
                "posts": {
                  "take": 2,
                },
              },
              "where": {
                "id": 1,
              },
            },
            "model": "User",
          },
        ]
      `);
    });

    it('only matches under the pinned type when a segment has a type', async () => {
      const result = await execute({
        schema: entriesSchema,
        document: gql`
          query {
            entries: entriesWithVariantTypedPath {
              kind
              ... on AppointmentEntry {
                appointment {
                  id
                  posts {
                    id
                  }
                }
              }
              ... on VariantEntry {
                appointment {
                  id
                  profile {
                    bio
                  }
                }
              }
            }
          }
        `,
        contextValue: { user: { id: 1 } },
      });

      expect(result.errors).toBeUndefined();
      // The VariantEntry selection is skipped, so its profile relation is loaded separately
      expect(queries[0]).toEqual({
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { include: { posts: true }, where: { id: 1 } },
      });
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
