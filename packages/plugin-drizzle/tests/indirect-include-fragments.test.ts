import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { DocumentNode, GraphQLResolveInfo } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { getSchemaConfig } from '../src/utils/config';
import { queryFromInfo } from '../src/utils/map-query';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';
import type { posts, users } from './example/db/schema';

// A schema where a drizzle-backed field only exists on one implementation of an interface, so it
// can only be selected behind an inline fragment or fragment spread.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { user: { id: number } };
}>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
    title: t.exposeString('title'),
  }),
});

const PostPreview = builder.objectRef<typeof posts.$inferSelect>('PostPreview').implement({
  fields: (t) => ({
    post: t.field({
      type: Post,
      resolve: (post) => post,
    }),
  }),
});

builder.drizzleObject('userProfile', {
  name: 'Profile',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    profile: t.relation('profile'),
    posts: t.relation('posts'),
    postPreviews: t.field({
      type: [PostPreview],
      select: (_args, _ctx, nestedSelection) => ({
        with: {
          posts: nestedSelection({ limit: 2 }, ['post']),
        },
      }),
      resolve: (user) => user.posts,
    }),
  }),
});

interface AppointmentEntryShape {
  kind: 'appointment';
  user: typeof users.$inferSelect;
}

interface OtherEntryShape {
  kind: 'other';
}

interface VariantEntryShape {
  kind: 'variant';
  user: typeof users.$inferSelect;
}

type EntryShape = AppointmentEntryShape | OtherEntryShape | VariantEntryShape;

const Viewer = builder.drizzleObject('users', {
  variant: 'Viewer',
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    profile: t.relation('profile'),
  }),
});

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

// Not a declared subtype of Entry, but shares an implementation with it
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

// Same field name as AppointmentEntry.appointment, same table, different variant
builder.objectRef<VariantEntryShape>('VariantEntry').implement({
  interfaces: [Entry],
  fields: (t) => ({
    appointment: t.field({
      type: Viewer,
      resolve: (entry) => entry.user,
    }),
  }),
});

const OtherEntry = builder.objectRef<OtherEntryShape>('OtherEntry').implement({
  interfaces: [Entry],
  fields: (t) => ({
    // Same field name as AppointmentEntry.appointment, but a different drizzle table
    appointment: t.drizzleField({
      type: Post,
      resolve: (query) => db.query.posts.findFirst(query({ where: { postId: 1 } })),
    }),
  }),
});

const EntryUnion = builder.unionType('EntryUnion', {
  types: [AppointmentEntry, OtherEntry],
  resolveType: (entry) => (entry.kind === 'appointment' ? 'AppointmentEntry' : 'OtherEntry'),
});

async function resolveEntries(
  context: object,
  info: GraphQLResolveInfo,
  path: (string | { name: string; type?: string })[],
): Promise<(AppointmentEntryShape | OtherEntryShape)[]> {
  const query = queryFromInfo({
    config: getSchemaConfig(builder),
    context,
    info,
    typeName: 'User',
    path,
  });

  const user = await db.query.users.findFirst({
    ...query,
    where: { id: 1 },
  });

  if (!user) {
    throw new Error('Expected user 1 to exist');
  }

  return [{ kind: 'appointment', user }, { kind: 'other' }];
}

async function resolveEntriesWithVariant(
  context: object,
  info: GraphQLResolveInfo,
  path: (string | { name: string; type?: string })[],
): Promise<EntryShape[]> {
  const entries = await resolveEntries(context, info, path);
  const user = (entries[0] as AppointmentEntryShape).user;

  return [...entries, { kind: 'variant', user }];
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
    unionEntries: t.field({
      type: [EntryUnion],
      resolve: (_root, _args, context, info) => resolveEntries(context, info, ['appointment']),
    }),
    me: t.drizzleField({
      type: User,
      resolve: (query, _root, _args, ctx) =>
        db.query.users.findFirst(query({ where: { id: ctx.user.id } })),
    }),
  }),
});

const schema = builder.toSchema();

async function run(document: DocumentNode) {
  clearDrizzleLogs();

  const result = await execute({
    schema,
    document,
    contextValue: { user: { id: 1 } },
  });

  return { result, logs: [...drizzleLogs] };
}

const expectedEntries = {
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
    clearDrizzleLogs();
  });

  describe('queryFromInfo path into a field behind a narrowing fragment', () => {
    it('resolves the field through an inline fragment on an implementing type', async () => {
      const { result, logs } = await run(gql`
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
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedEntries);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('"posts"');
    });

    it('resolves the field through a fragment spread on an implementing type', async () => {
      const { result, logs } = await run(gql`
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
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedEntries);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('"posts"');
    });

    it('accepts { name, type } segments to pin the fragment type', async () => {
      const { result, logs } = await run(gql`
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
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedEntries);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('"posts"');
    });
  });

  describe('fragments on overlapping abstract types', () => {
    it('resolves the field through a fragment on an interface that overlaps the list type', async () => {
      const { result, logs } = await run(gql`
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
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedEntries);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('"posts"');
    });

    it('resolves the field through a fragment on a union member', async () => {
      const { result, logs } = await run(gql`
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
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(expectedEntries);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('"posts"');
    });
  });

  describe('path segment validation', () => {
    it('reports an unknown segment type instead of crashing', async () => {
      const { result } = await run(gql`
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
      `);

      expect(result.errors?.[0]?.message).toContain('Unknown type Nope');
    });
  });

  describe('multiple matches for the same segment', () => {
    it('merges selections from every fragment that selects the field', async () => {
      const { result, logs } = await run(gql`
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
              id
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('"posts"');
      expect(logs[0]).toContain('"profile"');
    });

    it('walks a variant of the target table with its own fields', async () => {
      const { result, logs } = await run(gql`
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
                username
                profile {
                  id
                }
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        entries: [
          ...expectedEntries.entries,
          {
            kind: 'variant',
            appointment: { id: '1', username: expect.any(String), profile: expect.anything() },
          },
        ],
      });
      // The first query carries the relations selected under both fragments. The loader mapping
      // is recorded for the User type, so the Viewer variant's `id` is fetched by the model
      // loader afterwards; no relation is re-queried.
      expect(logs[0]).toContain('"posts"');
      expect(logs[0]).toContain('"profile"');
      expect(logs.slice(1).join('\n')).not.toContain('"posts"');
      expect(logs.slice(1).join('\n')).not.toContain('"profile"');
    });
  });

  describe('same field name on multiple implementations', () => {
    it('skips matches whose field returns a different drizzle table', async () => {
      const { result, logs } = await run(gql`
        query {
          entries {
            kind
            ... on OtherEntry {
              appointment {
                id
                title
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
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        entries: [
          expectedEntries.entries[0],
          { kind: 'other', appointment: { id: '1', title: expect.any(String) } },
        ],
      });
      // One query for the user with its posts relation, one for the other entry's post
      expect(logs).toHaveLength(2);
      expect(logs[0]).toContain('"users"');
      expect(logs[0]).toContain('"posts"');
      expect(logs[1]).not.toContain('"users"');
    });
  });

  describe('nestedSelection path into a field selected through a fragment', () => {
    it('plans the same query whether the field is selected directly or through a fragment', async () => {
      const direct = await run(gql`
        query {
          me {
            postPreviews {
              post {
                id
                title
              }
            }
          }
        }
      `);

      const inline = await run(gql`
        query {
          me {
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
      `);

      const spread = await run(gql`
        query {
          me {
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
      `);

      expect(direct.result.errors).toBeUndefined();
      expect(direct.logs).toHaveLength(1);
      expect(direct.logs[0]).toContain('"title"');

      expect(inline.result).toEqual(direct.result);
      expect(inline.logs).toEqual(direct.logs);

      expect(spread.result).toEqual(direct.result);
      expect(spread.logs).toEqual(direct.logs);
    });
  });
});
