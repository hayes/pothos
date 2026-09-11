import { execute } from '@pothos/test-utils';
import { eq, not, notInArray, sql } from 'drizzle-orm';
import { gql } from 'graphql-tag';
import { queryClient } from './postgres/db';
import {
  db,
  EDITION_COUNT,
  POST_ID,
  postTags,
  seed,
  TAG_COUNT,
  tags,
} from './postgres/junction-keys/db';
import { schema } from './postgres/junction-keys/schema';

const statements: string[] = [];

const session = Object.getPrototypeOf((db as unknown as { _: { session: object } })._.session) as {
  prepareQuery: (...args: unknown[]) => unknown;
};
const prepareQuery = session.prepareQuery;

session.prepareQuery = function patched(this: unknown, ...args: unknown[]) {
  statements.push((args[0] as { sql: string }).sql);

  return prepareQuery.apply(this, args);
};

beforeAll(seed);

afterAll(async () => {
  await queryClient.end();
});

async function query(document: string) {
  statements.length = 0;

  const result = await execute({ schema, document: gql(document), contextValue: {} });

  expect(result.errors).toBeUndefined();

  return result.data as Record<string, { [field: string]: number }>;
}

function onlyStatement() {
  expect(statements).toHaveLength(1);

  return statements[0] as string;
}

describe('a many-to-many relation the target table alone has to be filtered by, on postgres', () => {
  describe('a `through` column that is nullable', () => {
    it('reproduces `not exists`, which an unguarded `not in` does not', async () => {
      const notExists = await db.$count(
        tags,
        not(
          sql`exists (select 1 from ${postTags} where ${postTags.postId} = ${POST_ID} and ${postTags.tagId} = ${tags.id})`,
        ),
      );

      const unguarded = await db.$count(
        tags,
        notInArray(
          tags.id,
          db.select({ key: postTags.tagId }).from(postTags).where(eq(postTags.postId, POST_ID)),
        ),
      );

      expect(notExists).toBe(TAG_COUNT - 1);
      expect(unguarded).toBe(0);

      const data = await query(`{ post(id: ${POST_ID}) { relatedTagCount unrelatedTagCount } }`);

      expect(data.post).toEqual({ relatedTagCount: 1, unrelatedTagCount: notExists });
    });
  });

  describe('the SQL it emits', () => {
    it('keeps EXISTS without adding a target self-join', async () => {
      await query(`{ post(id: ${POST_ID}) { relatedTagCount } }`);

      const statement = onlyStatement();

      expect(statement).toContain('exists (select 1 from "jk_post_tags"');
      expect(statement).not.toContain('_pothos_related');
      expect(statement).not.toContain('inner join');
    });

    it('preserves scoped target restrictions in EXISTS', async () => {
      const data = await query(`{ post(id: ${POST_ID}) { scopedTagCount } }`);
      expect(data.post).toEqual({ scopedTagCount: 0 });
      expect(onlyStatement()).toContain('"jk_tags"."name" =');
    });

    it('counts a target a composite key names without a distinct column to count by', async () => {
      const data = await query(`{ post(id: ${POST_ID}) { editionCount } }`);

      expect(data.post).toEqual({ editionCount: 2 });
      expect(onlyStatement()).toContain('exists (select 1 from "jk_post_editions"');
    });

    it('keeps EXISTS for a text relation key', async () => {
      const data = await query(`{ post(id: ${POST_ID}) { editionCodeCount } }`);

      expect(data.post).toEqual({ editionCodeCount: 2 });
      expect(onlyStatement()).toContain('exists (select 1 from "jk_post_editions"');
    });
  });

  describe('a `through` spanning two columns', () => {
    it('keeps EXISTS for composite joins and preserves negation', async () => {
      const data = await query(
        `{ post(id: ${POST_ID}) { editionSlotCount unrelatedEditionSlotCount } }`,
      );

      expect(data.post).toEqual({
        editionSlotCount: 2,
        unrelatedEditionSlotCount: EDITION_COUNT - 2,
      });

      expect(onlyStatement()).toContain('exists (select 1 from "jk_post_editions"');
    });
  });
});
