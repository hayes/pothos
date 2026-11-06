import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { execute, parse, subscribe } from 'graphql';
import DrizzlePlugin, { getSchemaConfig, queryFromInfo } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

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
});
