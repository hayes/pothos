import { Collection } from '@prisma/orm-family-sql/orm-client';
import sqlite from '@prisma/orm-sqlite/runtime';
import { describe, expect, it } from 'vitest';
import { collectionFromInfo } from '../src';
import {
  createBuilder,
  run,
  type SampleContract,
  sampleContract,
  useSampleDb,
} from './fixtures/helpers';

const db = useSampleDb();

function schema() {
  const builder = createBuilder();
  const User = builder.prismaObject('User', {
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      // A filtered to-many relation loads into a slot of its own, which the rows must lose.
      drafts: t.relation('posts', { query: { where: { published: 0 } } }),
      postCount: t.relationCount('posts'),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({ title: t.exposeString('title'), author: t.relation('author') }),
  });
  // Its select loads a to-one relation, which a row returned to it must hold.
  const Authored = builder.prismaObject('Post', {
    variant: 'AuthoredPost',
    select: { author: true },
    fields: (t) => ({
      title: t.exposeString('title'),
      authorName: t.string({ resolve: (post) => post.author.firstName }),
    }),
  });
  type PlannedUser = typeof User.$inferType | null;
  const Payload = builder.objectRef<{ user: PlannedUser }>('RenamePayload').implement({
    fields: (t) => ({
      user: t.field({ type: User, nullable: true, resolve: (p) => p.user }),
    }),
  });
  const Stats = builder.objectRef<{ user: PlannedUser; posts: number }>('UserStats').implement({
    fields: (t) => ({
      user: t.field({ type: User, nullable: true, resolve: (p) => p.user }),
      posts: t.exposeInt('posts'),
    }),
  });
  const loadedPosts: object[] = [];
  builder.queryType({
    fields: (t) => ({
      user: t.field({
        type: User,
        nullable: true,
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({
            collection: db.orm.User.where({ id: 'u-alice' }),
            context,
            info,
          });
          return users.first();
        },
      }),
      users: t.field({
        type: [User],
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({ collection: db.orm.User, context, info });
          // A collection derived from the planned one keeps its selection.
          return users.orderBy((user) => user.id.asc()).all();
        },
      }),
      stats: t.field({
        type: Stats,
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({
            collection: db.orm.User.where({ id: 'u-alice' }),
            context,
            info,
            path: ['user'],
          });
          // An aggregate key named like a relation is a value, not rows of the relation.
          const { posts } = await users.aggregate((user) => ({ posts: user.count() }));
          return { user: await users.first(), posts };
        },
      }),
      included: t.field({
        type: [User],
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({
            collection: db.orm.User.include('posts'),
            context,
            info,
          });
          return users.all();
        },
      }),
      authored: t.field({
        type: Authored,
        nullable: true,
        resolve: async (_root, _args, context, info) => {
          const posts = await collectionFromInfo({
            collection: db.orm.Post.where({ id: 'p-hello' }),
            context,
            info,
          });
          const post = await posts.first();
          if (post) {
            loadedPosts.push(post);
          }
          return post;
        },
      }),
      iterated: t.field({
        type: [User],
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({ collection: db.orm.User, context, info });
          const rows = [];
          for await (const user of users.orderBy((u) => u.id.asc()).all()) {
            rows.push(user);
          }
          return rows;
        },
      }),
    }),
  });
  builder.mutationType({
    fields: (t) => ({
      renameUser: t.field({
        type: Payload,
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({
            collection: db.orm.User.where({ id: 'u-bob' }),
            context,
            info,
            path: ['user'],
          });
          return { user: await users.update({ firstName: 'Robert' }) };
        },
      }),
    }),
  });
  return Object.assign(builder.toSchema(), { loadedPosts });
}

describe('collectionFromInfo', () => {
  it("loads the field's selection, relations included, in one statement", async () => {
    const result = await run(
      schema(),
      '{ user { firstName postCount drafts { title author { firstName } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({
      firstName: 'Alice',
      postCount: 2,
      drafts: [{ title: 'Draft #1', author: { firstName: 'Alice' } }],
    });
    expect(result.statements).toHaveLength(1);
  });

  it("loads the to-one relations the returned type's select names into the rows", async () => {
    const built = schema();
    const result = await run(built, '{ authored { title } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.authored).toEqual({ title: 'Hello, Pothos' });
    // The row holds `author` before any field of the type resolves.
    expect(built.loadedPosts).toEqual([
      expect.objectContaining({ author: expect.objectContaining({ id: 'u-alice' }) }),
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('plans collections derived from the planned one', async () => {
    const result = await run(schema(), '{ users { firstName drafts { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { firstName: 'Alice', drafts: [{ title: 'Draft #1' }] },
      { firstName: 'Bob', drafts: [{ title: 'Bob draft' }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('returns rows that can be iterated', async () => {
    const result = await run(schema(), '{ iterated { firstName drafts { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.iterated).toEqual([
      { firstName: 'Alice', drafts: [{ title: 'Draft #1' }] },
      { firstName: 'Bob', drafts: [{ title: 'Bob draft' }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('runs value terminals such as aggregate on the collection', async () => {
    const result = await run(schema(), '{ stats { posts user { firstName drafts { title } } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.stats).toEqual({
      posts: 1,
      user: { firstName: 'Alice', drafts: [{ title: 'Draft #1' }] },
    });
  });

  it('rejects a collection that already includes a relation', async () => {
    const result = await run(schema(), '{ included { firstName } }');
    expect(result.errors?.[0]?.message).toMatch(/already includes 'posts'/);
  });

  it("runs a custom collection's methods, which read its private fields, on the collection", async () => {
    class UserCollection extends Collection<SampleContract, 'User'> {
      #prefix = 'B';
      initial() {
        return this.#prefix;
      }
      named(firstName: string) {
        return this.where({ firstName });
      }
    }
    const client = sqlite({
      contract: sampleContract,
      path: db.path,
      collections: { User: UserCollection },
    });
    try {
      const builder = createBuilder({ client });
      const User = builder.prismaObject('User', {
        fields: (t) => ({
          firstName: t.exposeString('firstName'),
          drafts: t.relation('posts', { query: { where: { published: 0 } } }),
        }),
      });
      builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
      builder.queryType({
        fields: (t) => ({
          users: t.field({
            type: [User],
            resolve: async (_root, _args, context, info) => {
              const users = await collectionFromInfo({
                collection: client.orm.User,
                context,
                info,
              });
              return users.named(users.initial() === 'B' ? 'Bob' : '').all();
            },
          }),
        }),
      });
      const result = await run(builder.toSchema(), '{ users { firstName drafts { title } } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toEqual([{ firstName: 'Bob', drafts: [{ title: 'Bob draft' }] }]);
    } finally {
      await client.close();
    }
  });

  it('applies the selection beneath a path to what a write returns', async () => {
    const result = await run(
      schema(),
      'mutation { renameUser { user { firstName postCount drafts { title } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.renameUser).toEqual({
      user: { firstName: 'Robert', postCount: 2, drafts: [{ title: 'Bob draft' }] },
    });
    // The ORM's update reads the key, writes, and reads the row back with the selection. Nothing is
    // loaded again for the payload's fields.
    expect(result.statements).toHaveLength(3);
    expect(result.statements[2]!.sql).toContain('Mutation.renameUser/User.drafts');
  });
});
