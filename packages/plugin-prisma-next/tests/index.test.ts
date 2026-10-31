import { PothosValidationError } from '@pothos/core';
import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { buildExampleSchema } from './example/schema';
import { columnsOf, createBuilder, globalId, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();
const query = (source: string) => run(buildExampleSchema(db), source);

describe('example schema', () => {
  it('generates the expected schema', () => {
    expect(printSchema(buildExampleSchema(db))).toMatchSnapshot();
  });

  it('plans nested relations, counts and aggregates into one statement', async () => {
    const result = await query(`{
      users {
        firstName postCount publishedCount maxPublished minPublished postStats
        posts { title commentCount author { firstName } comments { body author { firstName } } }
        basic { firstName posts { title } }
      }
    }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      firstName: 'Alice',
      postCount: 2,
      publishedCount: 1,
      maxPublished: 1,
      minPublished: 0,
      postStats: '2/1/1',
      posts: [
        {
          title: 'Hello, Pothos',
          commentCount: 2,
          author: { firstName: 'Alice' },
          comments: [
            { body: 'Looks great!', author: { firstName: 'Bob' } },
            { body: 'Glad to see this working.', author: { firstName: 'Alice' } },
          ],
        },
        { title: 'Draft #1', commentCount: 0, author: { firstName: 'Alice' }, comments: [] },
      ],
      basic: { firstName: 'Alice', posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }] },
    });
    expect(result.statements).toHaveLength(1);
  });

  it('selects only the queried columns, by column name rather than field name', async () => {
    const result = await query('{ users { firstName posts { isPublished } } }');
    expect(result.errors).toBeUndefined();
    const [{ sql }] = result.statements;
    expect(columnsOf(sql, 'user')).toEqual(new Set(['firstName', 'id']));
    expect(columnsOf(sql, 'post')).toEqual(new Set(['published', 'authorId', 'id']));
  });

  it('hoists the columns a computed field declares', async () => {
    const result = await query('{ users { fullName } }');
    expect(result.data.users).toEqual([{ fullName: 'Alice Andrews' }, { fullName: 'Bob Brown' }]);
    expect(columnsOf(result.statements[0].sql, 'user')).toEqual(
      new Set(['firstName', 'lastName', 'id']),
    );
  });

  it('selects only the identity column beside a field without dependencies', async () => {
    const result = await query('{ users { constant firstName } }');
    expect(result.data.users).toEqual([
      { constant: 'constant', firstName: 'Alice' },
      { constant: 'constant', firstName: 'Bob' },
    ]);
    expect(columnsOf(result.statements[0].sql, 'user')).toEqual(new Set(['firstName', 'id']));
  });

  it('always selects the join columns of included relations', async () => {
    const result = await query('{ posts { title author { email } } }');
    expect(result.errors).toBeUndefined();
    const { sql } = result.statements[0];
    expect(columnsOf(sql, 'post')).toEqual(new Set(['title', 'authorId', 'id']));
    expect(result.data.posts[0]).toEqual({
      title: 'Hello, Pothos',
      author: { email: 'alice@example.com' },
    });
  });

  it('selects the identity columns a node ID needs', async () => {
    const result = await query('{ users { id } }');
    expect(result.data.users).toEqual([
      { id: globalId('User', 'u-alice') },
      { id: globalId('User', 'u-bob') },
    ]);
    expect(columnsOf(result.statements[0].sql, 'user')).toEqual(new Set(['id']));
  });

  it('limits singular root fields to one row and leaves list fields unbounded', async () => {
    const single = await query('{ user(email: "bob@example.com") { firstName } }');
    expect(single.data).toEqual({ user: { firstName: 'Bob' } });
    expect(single.statements[0].sql).toMatch(/LIMIT 1\b/);
    const missing = await query('{ user(email: "nobody@example.com") { firstName } }');
    expect(missing).toMatchObject({ data: { user: null }, errors: undefined });
    const list = await query('{ users { firstName } }');
    expect(list.statements[0].sql).not.toMatch(/LIMIT/);
  });

  it('loads type-level selects and prismaObjectField(s) fields on every level', async () => {
    const result = await query(
      '{ users { comments { ref shout whisper post { comments { ref } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[1].comments).toEqual([
      {
        ref: 'c-1',
        shout: 'LOOKS GREAT!',
        whisper: 'looks great!',
        post: { comments: [{ ref: 'c-1' }, { ref: 'c-2' }] },
      },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('pages a root connection and a related connection in one statement', async () => {
    const result = await query(`{
      usersConnection(first: 1) {
        totalCount
        pageInfo { hasNextPage }
        edges { node { firstName postsConnection(first: 1) { totalCount nodes { title } } } }
      }
    }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.usersConnection).toEqual({
      totalCount: 2,
      pageInfo: { hasNextPage: true },
      edges: [
        {
          node: {
            firstName: 'Alice',
            postsConnection: { totalCount: 2, nodes: [{ title: 'Draft #1' }] },
          },
        },
      ],
    });
  });
});

describe('root fields', () => {
  it.each([
    ['row', { id: 'u-alice' }],
    ['rows', [{ id: 'u-alice' }]],
  ])('reject an already materialized %s', async (_name, value) => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: 'User', nullable: true, resolve: () => value as never }),
        none: t.prismaField({ type: 'User', nullable: true, resolve: () => null }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { id } none { id } }');
    expect(result.data).toEqual({ user: null, none: null });
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].message).toMatch(/must return an ORM Collection or null/);
    expect(result.errors?.[0].originalError).toBeInstanceOf(PothosValidationError);
  });
});
