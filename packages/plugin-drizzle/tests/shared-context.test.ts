import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { execute, parse, subscribe } from 'graphql';
import DrizzlePlugin, { getSchemaConfig, queryFromInfo } from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// Executions sharing a context keep their loader mappings apart, so rows a later operation or
// subscription event loaded elsewhere never resolve a filtered relation from the rows they hold.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: object;
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

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    publishedPosts: t.relation('posts', { query: { where: { published: 1 } } }),
    allPosts: t.relation('posts'),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    published: t.exposeInt('published'),
    author: t.relation('author'),
  }),
});

// Every post, drafts included, as rows loaded outside the plan hold them.
const withAllPosts = { where: { id: 1 }, with: { posts: true } } as const;

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    rawUser: t.field({
      type: User,
      resolve: () => db.query.users.findFirst(withAllPosts),
    }),
  }),
});

builder.subscriptionType({
  fields: (t) => ({
    // The first event is planned, the second hands on a row loaded elsewhere.
    user: t.field({
      type: User,
      subscribe: async function* () {
        yield await Promise.resolve(true);
        yield false;
      },
      resolve: async (planned: boolean, _args, context, info) => {
        const user = planned
          ? await db.query.users.findFirst(
              queryFromInfo({ config: getSchemaConfig(builder), context, info, where: { id: 1 } }),
            )
          : await db.query.users.findFirst(withAllPosts);

        return user as never;
      },
    }),
    // Loads each event in `subscribe` with the planned query, as a snapshot of a row since
    // deleted: its id matches no row, so reloading it fails.
    deletedUser: t.field({
      type: User,
      subscribe: async function* (_root, _args, context, info) {
        const snapshot = await db.query.users.findFirst(
          queryFromInfo({ config: getSchemaConfig(builder), context, info, where: { id: 1 } }),
        );

        yield { ...snapshot, id: -1 };
      },
      resolve: (user) => user as never,
    }),
    // Yields a snapshot loaded with the planned query, then a row from elsewhere holding every post.
    snapshotThenRaw: t.field({
      type: User,
      subscribe: async function* (_root, _args, context, info) {
        yield await db.query.users.findFirst(
          queryFromInfo({ config: getSchemaConfig(builder), context, info, where: { id: 1 } }),
        );
        yield await db.query.users.findFirst(withAllPosts);
      },
      resolve: (user) => user as never,
    }),
  }),
});

const schema = builder.toSchema();

function drafts(result: unknown) {
  return JSON.stringify(result).match(/"published":0/g)?.length ?? 0;
}

describe('executions sharing a context', () => {
  it('keeps the relation filter on rows a later operation loaded elsewhere', async () => {
    const contextValue = {};
    const planned = await execute({
      schema,
      document: parse('{ user { publishedPosts { published } } }'),
      contextValue,
    });
    const raw = await execute({
      schema,
      document: parse('{ user: rawUser { publishedPosts { published } } }'),
      contextValue,
    });

    expect(drafts(planned)).toBe(0);
    expect(raw).toEqual(planned);
  });

  it('reloads a row for a later operation sharing the context with its own selection', async () => {
    const contextValue = {};
    const query = (posts: string) =>
      execute({
        schema,
        document: parse(`{ rawUser { posts: ${posts} { published } } }`),
        contextValue,
      });

    expect(drafts(await query('allPosts'))).toBeGreaterThan(0);
    expect(drafts(await query('publishedPosts'))).toBe(0);
  });

  it('keeps the relation filter on a row a later subscription event loaded elsewhere', async () => {
    const events = await subscribe({
      schema,
      document: parse('subscription { user { publishedPosts { published } } }'),
      contextValue: {},
    });

    if (!(Symbol.asyncIterator in events)) {
      throw new Error(`Expected a subscription, got ${JSON.stringify(events)}`);
    }

    const seen: unknown[] = [];

    for await (const event of events) {
      seen.push(event);
    }

    expect(drafts(seen[0])).toBe(0);
    expect(seen[1]).toEqual(seen[0]);
  });

  it('reloads the parent of an event its subscribe loaded with the planned query', async () => {
    clearDrizzleLogs();

    const events = await subscribe({
      schema,
      document: parse('subscription { deletedUser { publishedPosts { published } } }'),
      contextValue: {},
    });

    if (!(Symbol.asyncIterator in events)) {
      throw new Error(`Expected a subscription, got ${JSON.stringify(events)}`);
    }

    const seen: unknown[] = [];

    for await (const event of events) {
      seen.push(event);
    }

    const [{ errors, data }] = seen as {
      errors?: { path: unknown }[];
      data: { deletedUser: { publishedPosts: unknown } };
    }[];

    // Each event is its own execution: the snapshot's relations load from its parent row, which
    // no longer exists, as they would for a deleted row from anywhere else.
    expect(seen).toHaveLength(1);
    expect(data.deletedUser.publishedPosts).toBeNull();
    expect(errors?.map(({ path }) => path)).toEqual([['deletedUser', 'publishedPosts']]);
    expect(drizzleLogs).toHaveLength(2);
  });

  it('reloads a raw event yielded after a planned snapshot', async () => {
    const events = await subscribe({
      schema,
      document: parse('subscription { snapshotThenRaw { publishedPosts { published } } }'),
      contextValue: {},
    });

    if (!(Symbol.asyncIterator in events)) {
      throw new Error(`Expected a subscription, got ${JSON.stringify(events)}`);
    }

    const seen: unknown[] = [];

    for await (const event of events) {
      seen.push(event);
    }

    expect(seen).toHaveLength(2);
    expect(drafts(seen[0])).toBe(0);
    expect(drafts(seen[1])).toBe(0);
    expect(seen[1]).toEqual(seen[0]);
  });
});
