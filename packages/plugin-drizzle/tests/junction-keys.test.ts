import { execute } from '@pothos/test-utils';
import { aliasedTable, eq, inArray, relationToSQL, sql } from 'drizzle-orm';
import { gql } from 'graphql-tag';
import { buildRelationFilter } from '../src/utils/relation-filter';
import {
  client,
  db,
  EDITION_COUNT,
  POST_ID,
  posts,
  postTags,
  relations,
  seed,
  TAG_COUNT,
  tags,
} from './junction-keys/db';
import { schema } from './junction-keys/schema';

const statements: { sql: string; args: unknown }[] = [];
const runStatement = client.execute.bind(client);
(client as unknown as { execute: unknown }).execute = (statement: unknown, ...rest: unknown[]) => {
  statements.push(
    typeof statement === 'string'
      ? { sql: statement, args: [] }
      : (statement as { sql: string; args: unknown }),
  );
  return (runStatement as (...args: unknown[]) => unknown)(statement, ...rest);
};
beforeAll(seed);
afterAll(() => client.close());

async function query(fields: string, id = POST_ID) {
  statements.length = 0;
  const result = await execute({
    schema,
    document: gql(`{ post(id: ${id}) { ${fields} } }`),
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(statements).toHaveLength(1);
  return (result.data as { post: Record<string, number> }).post;
}
async function plan() {
  const statement = statements[0];
  const result = await runStatement({
    sql: `explain query plan ${statement.sql}`,
    args: statement.args as never,
  });
  return result.rows.map((row) => String(row.detail)).join('\n');
}

describe('many-to-many target identity lookup', () => {
  it('counts each target once, ignores dangling/null junction keys, and preserves negation', async () => {
    expect(await query('relatedTagCount unrelatedTagCount')).toEqual({
      relatedTagCount: 2,
      unrelatedTagCount: TAG_COUNT - 2,
    });
    expect(await query('relatedTagCount unrelatedTagCount', 2)).toEqual({
      relatedTagCount: 1,
      unrelatedTagCount: TAG_COUNT - 1,
    });
    expect(await query('relatedTagCount unrelatedTagCount', 3)).toEqual({
      relatedTagCount: 0,
      unrelatedTagCount: TAG_COUNT,
    });
  });
  it('looks up target identities without scanning the outer target table', async () => {
    await query('relatedTagCount');
    expect(statements[0].sql).toContain('"tags"."id" in (select "_pothos_related"."id"');
    expect(statements[0].sql).toContain('inner join "tags" "_pothos_related"');
    expect(await plan()).toContain('SEARCH tags USING INTEGER PRIMARY KEY');
    expect(await plan()).not.toContain('SCAN tags');
  });
  it('applies target restrictions inside the join without correlating back to the outer target', async () => {
    expect(await query('scopedTagCount')).toEqual({ scopedTagCount: 1 });
    expect(statements[0].sql).toContain('"_pothos_related"."name" =');
    expect(await plan()).toContain('SEARCH tags USING INTEGER PRIMARY KEY');
    expect(await plan()).not.toContain('SCAN tags');
  });
  it('preserves static RAW scope semantics even though the outer reference requires a scan', async () => {
    expect(await query('staticRawTagCount unrelatedStaticRawTagCount')).toEqual({
      staticRawTagCount: 1,
      unrelatedStaticRawTagCount: TAG_COUNT - 1,
    });
    await query('staticRawTagCount');
    expect(statements[0].sql).toContain('"tags"."name" =');
    expect(await plan()).toContain('SCAN tags');
  });
  it('uses an indexed target lookup when a RAW callback uses the supplied table', async () => {
    expect(await query('callbackRawTagCount')).toEqual({ callbackRawTagCount: 1 });
    expect(statements[0].sql).toContain('"_pothos_related"."name" =');
    expect(await plan()).toContain('SEARCH tags USING INTEGER PRIMARY KEY');
    expect(await plan()).not.toContain('SCAN tags');
  });
  it('preserves collation precedence even when numeric columns contain text', async () => {
    const relation = relations.posts.relations.numericCodes;
    const { filter, joinCondition } = relationToSQL(relation, posts, tags, postTags);
    const [{ count: joined }] = await db
      .select({ count: sql<number>`count(distinct ${tags.id})` })
      .from(posts)
      .innerJoin(postTags, filter!)
      .innerJoin(tags, joinCondition!)
      .where(eq(posts.id, POST_ID));
    const directLookup = await db.$count(
      tags,
      inArray(
        tags.code,
        db.select({ code: postTags.code }).from(postTags).where(eq(postTags.postId, POST_ID)),
      ),
    );
    expect(joined).toBe(1);
    expect(directLookup).toBe(2);
    expect(await query('numericCodeCount unrelatedNumericCodeCount')).toEqual({
      numericCodeCount: joined,
      unrelatedNumericCodeCount: TAG_COUNT - joined,
    });
    expect(statements[0].sql).not.toContain('exists');
  });
  it.each([
    'editionCount',
    'editionCodeCount',
    'editionSlotCount',
  ])('supports composite target identities with numeric, text, and composite joins: %s', async (field) => {
    expect(await query(field)).toEqual({ [field]: 2 });
    expect(statements[0].sql).toContain('("editions"."series", "editions"."number") in (select');
    expect(statements[0].sql).not.toContain('exists');
    expect(await plan()).not.toContain('SCAN editions');
  });
  it('preserves differing text collations in a composite relation', async () => {
    const directLookup = await client.execute(`
      select count(*) as count from editions where (series, number) in (
        select series, number from post_editions where post_id = 1
      )
    `);
    expect(directLookup.rows[0].count).toBe(3);
    expect(await query('editionSlotCount')).toEqual({ editionSlotCount: 2 });
  });

  it('preserves negation for composite identities and nullable composite junction keys', async () => {
    expect(await query('editionSlotCount unrelatedEditionSlotCount')).toEqual({
      editionSlotCount: 2,
      unrelatedEditionSlotCount: EDITION_COUNT - 2,
    });
    expect(await query('editionSlotCount unrelatedEditionSlotCount', 3)).toEqual({
      editionSlotCount: 0,
      unrelatedEditionSlotCount: EDITION_COUNT,
    });
  });
  it('falls back to EXISTS when the only identity allows nulls', async () => {
    expect(await query('relatedLabelCount unrelatedLabelCount')).toEqual({
      relatedLabelCount: 2,
      unrelatedLabelCount: 1,
    });
    expect(statements[0].sql).toContain('exists (select 1 from "post_labels"');
  });
  it('does not shadow a parent alias when creating the matched-target alias', async () => {
    const parent = aliasedTable(posts, '_pothos_related');
    const filter = buildRelationFilter(db as never, relations.posts.relations.tags, parent, [
      tags.id,
    ]).filter;
    const result = await db
      .select({ id: parent.id, count: db.$count(tags, filter) })
      .from(parent)
      .where(eq(parent.id, POST_ID));
    expect(result).toEqual([{ id: POST_ID, count: 2 }]);
  });
});
