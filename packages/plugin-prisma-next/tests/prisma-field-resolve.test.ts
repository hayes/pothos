import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import { isUniqueConstraintViolation, SqlQueryError } from '@prisma/orm-family-sql/errors';
import { describe, expect, it } from 'vitest';
import PrismaNextPlugin from '../src';
import {
  createBuilder,
  loadContract,
  run,
  type SampleContract,
  useDatabase,
  useSampleDb,
} from './fixtures/helpers';
import type { Contract as InheritanceContract } from './inheritance/contract';

const db = useSampleDb();

function schema() {
  const builder = createBuilder();
  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      // A filtered to-many relation and a count, which the write's read-back must load.
      drafts: t.relation('posts', { query: { where: { published: 0 } } }),
      postCount: t.relationCount('posts'),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      author: t.relation('author'),
    }),
  });
  builder.prismaObject('Comment', {
    fields: (t) => ({ body: t.exposeString('body'), author: t.relation('author') }),
  });
  const createdAt = new Date('2026-05-01T00:00:00.000Z');
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        resolve: (users) => users.orderBy((user) => user.id.asc()).all(),
      }),
      user: t.prismaField({
        type: 'User',
        nullable: true,
        args: { id: t.arg.id({ required: true }) },
        resolve: (users, _root, args) => users.where({ id: String(args.id) }).first(),
      }),
    }),
  });
  builder.mutationType({
    fields: (t) => ({
      createPost: t.prismaField({
        type: 'Post',
        args: { id: t.arg.id({ required: true }) },
        resolve: (posts, _root, args) =>
          posts.create({
            id: String(args.id),
            title: 'Created',
            content: '',
            authorId: 'u-bob',
            createdAt,
          }),
      }),
      createPosts: t.prismaField({
        type: ['Post'],
        resolve: (posts) =>
          posts.createAll([
            {
              id: 'p-many1',
              title: 'Many 1',
              content: '',
              published: 1,
              authorId: 'u-alice',
              createdAt,
            },
            {
              id: 'p-many2',
              title: 'Many 2',
              content: '',
              published: 1,
              authorId: 'u-bob',
              createdAt,
            },
          ]),
      }),
      renameUser: t.prismaField({
        type: 'User',
        nullable: true,
        args: { id: t.arg.id({ required: true }), firstName: t.arg.string({ required: true }) },
        resolve: (users, _root, args) =>
          users.where({ id: String(args.id) }).update({ firstName: args.firstName }),
      }),
      upsertPost: t.prismaField({
        type: 'Post',
        args: { title: t.arg.string({ required: true }) },
        resolve: (posts, _root, args) =>
          posts.upsert({
            create: {
              id: 'p-upsert',
              title: args.title,
              content: '',
              authorId: 'u-bob',
              createdAt,
            },
            update: { title: args.title },
          }),
      }),
      deleteComment: t.prismaField({
        type: 'Comment',
        nullable: true,
        resolve: (comments) => comments.where({ id: 'c-1' }).delete(),
      }),
    }),
  });
  return builder.toSchema();
}

describe('prismaField resolve', () => {
  const built = schema();

  it('reads with the selection planned onto the collection', async () => {
    const result = await run(built, '{ users { firstName postCount drafts { title } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { firstName: 'Alice', postCount: 2, drafts: [{ title: 'Draft #1' }] },
      { firstName: 'Bob', postCount: 2, drafts: [{ title: 'Bob draft' }] },
    ]);
    expect(result.statements).toHaveLength(1);

    const one = await run(built, '{ user(id: "u-bob") { firstName drafts { title } } }');
    expect(one.data.user).toEqual({ firstName: 'Bob', drafts: [{ title: 'Bob draft' }] });
    expect(one.statements).toHaveLength(1);
  });

  it('returns null when the read finds no row', async () => {
    const result = await run(built, '{ user(id: "missing") { firstName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toBeNull();
    expect(result.statements).toHaveLength(1);
  });

  it('returns the row a create writes, with relations, without reading it again', async () => {
    const result = await run(
      built,
      'mutation { createPost(id: "p-created") { title author { firstName postCount } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.createPost).toEqual({
      title: 'Created',
      author: { firstName: 'Bob', postCount: 3 },
    });
    // The ORM's insert and its read of the row with the selection, and nothing after.
    expect(result.statements.map((s) => s.sql.split(' ')[0])).toEqual(['INSERT', 'SELECT']);

    const scalar = await run(built, 'mutation { createPost(id: "p-scalar") { title } }');
    expect(scalar.data.createPost).toEqual({ title: 'Created' });
    expect(scalar.statements.map((s) => s.sql.split(' ')[0])).toEqual(['INSERT']);
  });

  it("passes on a database error of the app's own write as it is", async () => {
    const result = await run(built, 'mutation { createPost(id: "p-hello") { title } }');
    const error = result.errors?.[0]?.originalError;
    expect(SqlQueryError.is(error)).toBe(true);
    expect(isUniqueConstraintViolation(error)).toBe(true);
    expect(result.errors?.[0]?.message).not.toBe('Unexpected error.');
  });

  it('returns the rows createAll writes', async () => {
    const result = await run(built, 'mutation { createPosts { title author { firstName } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.createPosts).toEqual([
      { title: 'Many 1', author: { firstName: 'Alice' } },
      { title: 'Many 2', author: { firstName: 'Bob' } },
    ]);
    expect(result.statements.map((s) => s.sql.split(' ')[0])).toEqual(['INSERT', 'SELECT']);
  });

  it('returns the row an update writes with filtered relations and counts', async () => {
    const result = await run(
      built,
      'mutation { renameUser(id: "u-alice", firstName: "Alicia") { firstName postCount drafts { title } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.renameUser).toEqual({
      firstName: 'Alicia',
      postCount: 3,
      drafts: [{ title: 'Draft #1' }],
    });
    // The ORM's update reads the key, writes, and reads the row back with the selection.
    expect(result.statements).toHaveLength(3);
    expect(result.statements[2]!.sql).toContain('__combine__');
  });

  it('returns null when an update matches no row', async () => {
    const result = await run(
      built,
      'mutation { renameUser(id: "missing", firstName: "X") { firstName drafts { title } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.renameUser).toBeNull();
    expect(result.statements).toHaveLength(1);
  });

  it('returns the row an upsert writes', async () => {
    const created = await run(
      built,
      'mutation { upsertPost(title: "First") { title author { firstName } } }',
    );
    expect(created.errors).toBeUndefined();
    expect(created.data.upsertPost).toEqual({ title: 'First', author: { firstName: 'Bob' } });
    const updated = await run(
      built,
      'mutation { upsertPost(title: "Second") { title author { firstName } } }',
    );
    expect(updated.data.upsertPost).toEqual({ title: 'Second', author: { firstName: 'Bob' } });
    for (const { statements } of [created, updated]) {
      expect(statements.map((s) => s.sql.split(' ')[0])).toEqual(['INSERT', 'SELECT']);
    }
  });

  it('returns the row a delete removes', async () => {
    const result = await run(built, 'mutation { deleteComment { body author { firstName } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.deleteComment).toEqual({
      body: 'Looks great!',
      author: { firstName: 'Bob' },
    });
    // The ORM reads the row with the selection, then deletes it.
    expect(result.statements.map((s) => s.sql.split(' ')[0])).toEqual(['SELECT', 'DELETE']);
    const again = await run(built, 'mutation { deleteComment { body } }');
    expect(again.data.deleteComment).toBeNull();
    expect(again.statements).toHaveLength(1);
  });
});

describe('prismaFieldWithInput', () => {
  const builder = new SchemaBuilder<{ PrismaContract: SampleContract }>({
    plugins: [WithInputPlugin, RelayPlugin, PrismaNextPlugin],
    relay: {},
    prisma: { client: db.client },
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      postCount: t.relationCount('posts'),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      byCollection: t.prismaFieldWithInput({
        type: 'User',
        nullable: true,
        input: { id: t.input.id({ required: true }) },
        collection: (_root, args) => db.orm.User.where({ id: String(args.input.id) }),
      }),
      byResolve: t.prismaFieldWithInput({
        type: 'User',
        nullable: true,
        input: { id: t.input.id({ required: true }) },
        resolve: (users, _root, args) => users.where({ id: String(args.input.id) }).first(),
      }),
    }),
  });
  const built = builder.toSchema();

  it('takes collection or resolve', async () => {
    const result = await run(
      built,
      '{ byCollection(input: { id: "u-bob" }) { firstName postCount } byResolve(input: { id: "u-bob" }) { firstName postCount } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.byCollection).toEqual(result.data.byResolve);
    expect(result.data.byResolve.firstName).toBe('Bob');
    expect(result.statements).toHaveLength(2);
  });
});

describe('prismaField resolve on a variant type', () => {
  const contract = loadContract<InheritanceContract>(
    new URL('./inheritance/contract.json', import.meta.url),
  );
  const variantDb = useDatabase(
    contract,
    `
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
    CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
    CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL, code TEXT UNIQUE, championId TEXT);
    CREATE TABLE note (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, featureCode TEXT);
    INSERT INTO user VALUES ('u1', 'a@example.com');
    INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high', NULL), ('t2', 'feat1', 'feature', 'u1', NULL, NULL);
    INSERT INTO feature VALUES ('t2', 5, 'f2', NULL);
  `,
  );
  const builder = new SchemaBuilder<{ PrismaContract: InheritanceContract }>({
    plugins: [RelayPlugin, PrismaNextPlugin],
    relay: {},
    prisma: { client: variantDb.client },
  });
  builder.prismaObject('User', { fields: (t) => ({ email: t.exposeString('email') }) });
  builder.prismaObject('Bug', {
    fields: (t) => ({
      title: t.exposeString('title'),
      severity: t.exposeString('severity'),
      owner: t.relation('owner'),
    }),
  });
  builder.prismaObject('Feature', {
    fields: (t) => ({ title: t.exposeString('title'), priority: t.exposeInt('priority') }),
  });
  builder.queryType({
    fields: (t) => ({
      bugs: t.prismaField({ type: ['Bug'], resolve: (bugs) => bugs.all() }),
      allBugs: t.prismaField({ type: ['Bug'] }),
      highBug: t.prismaField({
        type: 'Bug',
        nullable: true,
        query: { where: (bug) => bug.severity.eq('high') },
      }),
      bugPage: t.prismaConnection({ type: 'Bug' }),
    }),
  });
  builder.mutationType({
    fields: (t) => ({
      createBug: t.prismaField({
        type: 'Bug',
        resolve: (bugs) =>
          bugs.create({
            id: 't3',
            title: 'bug2',
            ownerId: 'u1',
            severity: 'low',
            reviewerId: null,
          }),
      }),
      updateFeature: t.prismaField({
        type: 'Feature',
        nullable: true,
        resolve: (features) => features.where({ id: 't2' }).update({ title: 'feat2' }),
      }),
      updateFeatures: t.prismaField({
        type: ['Feature'],
        resolve: (features) => features.where({ id: 't2' }).updateAll({ title: 'feat3' }),
      }),
      renameFeature: t.prismaField({
        type: 'Feature',
        nullable: true,
        resolve: async (features) => {
          const feature = features.where({ id: 't2' });
          await feature.updateAndCount({ title: 'feat4' });
          return feature.first();
        },
      }),
      deleteFeatures: t.prismaField({
        type: ['Feature'],
        resolve: (features) => features.where({ id: 'none' }).deleteAll(),
      }),
    }),
  });
  const built = builder.toSchema();

  it("gets the base's collection narrowed to the variant", async () => {
    const result = await run(built, '{ bugs { title severity owner { email } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.bugs).toEqual([
      { title: 'bug1', severity: 'high', owner: { email: 'a@example.com' } },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it("loads only the variant's rows without collection", async () => {
    const result = await run(
      built,
      '{ allBugs { title } highBug { title } bugPage(first: 5) { edges { node { title } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      allBugs: [{ title: 'bug1' }],
      highBug: { title: 'bug1' },
      bugPage: { edges: [{ node: { title: 'bug1' } }] },
    });
    expect(result.statements).toHaveLength(3);
    for (const { sql } of result.statements) {
      expect(sql).toContain('"type"');
    }
  });

  it('writes a row of the variant', async () => {
    const result = await run(built, 'mutation { createBug { title severity owner { email } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.createBug).toEqual({
      title: 'bug2',
      severity: 'low',
      owner: { email: 'a@example.com' },
    });
    expect(result.statements.map((s) => s.sql.split(' ')[0])).toEqual(['INSERT', 'SELECT']);
    expect(result.statements[0]!.sql).toContain('"type"');
    const bugs = await run(built, '{ bugs { title } }');
    expect(bugs.data.bugs).toEqual([{ title: 'bug1' }, { title: 'bug2' }]);
  });

  it("passes through an own-table variant's write error when returning variant columns", async () => {
    // The ORM's RETURNING covers only the base table, so these writes fail in the database.
    for (const field of ['updateFeature', 'updateFeatures', 'deleteFeatures']) {
      const result = await run(built, `mutation { ${field} { title priority } }`);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]!.originalError).toBeInstanceOf(SqlQueryError);
      expect(result.errors![0]!.message).toMatch(/priority/);
    }
    const base = await run(built, 'mutation { updateFeature { title } }');
    expect(base.errors).toBeUndefined();
    expect(base.data.updateFeature).toEqual({ title: 'feat2' });
    const reread = await run(built, 'mutation { renameFeature { title priority } }');
    expect(reread.errors).toBeUndefined();
    expect(reread.data.renameFeature).toEqual({ title: 'feat4', priority: 5 });
  });
});
