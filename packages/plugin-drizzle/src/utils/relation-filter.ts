import {
  aliasedTable,
  aliasedTableColumn,
  and,
  type Column,
  count,
  countDistinct,
  exists,
  getTableName,
  inArray,
  is,
  type Relation,
  relationToSQL,
  type SQL,
  type SQLWrapper,
  sql,
  type Table,
} from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

/**
 * The part of a drizzle client this module needs: enough of the core query builder to describe a
 * `select` over one table, optionally joined to a junction table. Every dialect's client has it.
 * It is narrowed here rather than added to the plugin's `DrizzleClient` option type because
 * nothing a user writes has to satisfy it beyond passing a real drizzle client.
 */
export interface RelationQueryBuilder {
  select: (fields: Record<string, SQL>) => {
    from: (table: Table) => {
      innerJoin: (table: Table, on: SQL) => { where: (filter?: SQL) => SQLWrapper };
      where: (filter?: SQL) => SQLWrapper;
    };
  };
}

export interface RelationFilter {
  /**
   * A predicate over the target table alone, for the places where only the target table is in
   * scope: a `where` handed to a user `select`, or a count that selects from the target table.
   * SQLite many-to-many relations with a non-null unique target key project identities through
   * Drizzle's join. Other cases use an `exists` over the junction.
   */
  filter: SQL;
  /**
   * Counts the rows the relation yields, as an expression for the surrounding query to select.
   * A many-to-many relation joins the junction table in, so the count matches the rows the
   * relational query builder returns for the same relation, junction duplicates included.
   *
   * `where` is the predicate the page query was given, and it goes ahead of the relation's own
   * predicate because that is the order the relational query builder combines the two in. The
   * count then repeats the page query's `where` verbatim, minus the limit and keyset clauses.
   */
  countRows: (where?: SQL) => SQL<number>;
  /**
   * Counts the distinct target rows the relation reaches, for the callers that count a related
   * row once however many junction rows lead to it. `key` identifies a target row, so it has to
   * be a single column the database guarantees is unique.
   *
   * This counts off the junction rather than counting the target table filtered by `filter`,
   * which says the same thing the long way round: the join reads the junction rows the parent
   * reaches and stops, where the filter reads the same rows and then looks every key it found
   * back up in the target table.
   */
  countDistinctRows: (key: Column, where?: SQL) => SQL<number>;
}

// `select 1`, for an `exists` that only has to find a row.
const one = { one: sql`1` };

/**
 * The parent-to-child SQL for one relation, built by drizzle so the plugin agrees with the
 * relational query builder on what "related" means: `through` (many-to-many), the relation's own
 * `where`, and a reversed relation's inherited `where` all come from drizzle rather than from a
 * join reassembled here out of source and target columns.
 *
 * Both the join and its restrictions come from `relationToSQL`, including when the target is
 * aliased for the identity lookup. No junction columns or comparisons are reconstructed here.
 *
 * `parentTable` is the parent as it appears in the surrounding query, so the aliased table when
 * the query builder aliased it.
 */
export function buildRelationFilter(
  client: RelationQueryBuilder,
  relation: Relation,
  parentTable: Table,
  targetKey?: Column[],
): RelationFilter {
  const targetTable = relation.targetTable as Table;
  const throughTable = relation.throughTable as Table | undefined;
  // `filter` correlates the parent to the target, or to the junction table when there is one, in
  // which case `joinCondition` is what carries the junction the rest of the way to the target.
  const { filter, joinCondition } = relationToSQL(
    relation,
    parentTable,
    targetTable,
    throughTable,
  ) as { filter: SQL; joinCondition?: SQL };

  if (!throughTable || !joinCondition) {
    // Without a junction table every related row is a distinct target row, so the two counts are
    // the same query.
    const countRows = (where?: SQL) =>
      countOf(client.select(countStar()).from(targetTable).where(and(where, filter)));

    return { filter, countRows, countDistinctRows: (_key, where) => countRows(where) };
  }

  const relatedRows = (aggregate: Record<string, SQL>, where?: SQL) =>
    countOf(
      client
        .select(aggregate)
        .from(targetTable)
        .innerJoin(throughTable, joinCondition)
        .where(and(where, filter)),
    );

  return {
    // SQLite needs the identity lookup to avoid target scans. PostgreSQL can plan EXISTS as
    // a semijoin; projecting identities adds a target join its planner may not eliminate.
    filter:
      targetKey?.length && is(targetTable, SQLiteTable)
        ? targetIdentityInRelation(
            client,
            relation,
            parentTable,
            targetTable,
            throughTable,
            targetKey,
          )
        : exists(client.select(one).from(throughTable).where(and(filter, joinCondition))),
    countRows: (where) => relatedRows(countStar(), where),
    countDistinctRows: (key, where) => relatedRows({ count: countDistinct(key) }, where),
  };
}

/**
 * Project a non-null unique target key through the original relation join, then compare that
 * key with itself. Comparing the target key directly with a junction column would change
 * SQLite's collation precedence. Keeping the join also handles composite relation keys and
 * excludes null junction keys without special truth-table guards.
 *
 * `key` must be a database-enforced unique constraint whose columns are all NOT NULL. That
 * makes membership identify exactly one target row and keeps negation two-valued. SQLite can
 * allow nulls even in primary keys, so callers must check notNull, not just primary.
 *
 * Build object restrictions and RAW callbacks against the inner target alias. Static RAW SQL
 * is passed through by Drizzle: references to the outer target can still force a target scan.
 * A RAW callback must use its supplied table to benefit from the identity lookup.
 */
function targetIdentityInRelation(
  client: RelationQueryBuilder,
  relation: Relation,
  parentTable: Table,
  targetTable: Table,
  throughTable: Table,
  key: Column[],
): SQL {
  const names = new Set([parentTable, targetTable, throughTable].map(getTableName));
  let alias = '_pothos_related';

  while (names.has(alias)) {
    alias += '_';
  }

  const matchedTable = aliasedTable(targetTable, alias);
  const { filter, joinCondition } = relationToSQL(
    relation,
    parentTable,
    matchedTable,
    throughTable,
  ) as { filter: SQL; joinCondition: SQL };
  const fields = Object.fromEntries(
    key.map((column, i) => [String(i), sql`${aliasedTableColumn(column, alias)}`]),
  );
  const columns = key.map((column) => sql`${column}`);
  const identity = columns.length === 1 ? columns[0] : sql`(${sql.join(columns, sql`, `)})`;

  return inArray(
    identity,
    client.select(fields).from(throughTable).innerJoin(matchedTable, joinCondition).where(filter),
  );
}

// A fresh `count(*)` each time: `mapWith` mutates the `SQL` it is called on, so a shared one
// would be re-decoded by every query that selected it.
function countStar(): Record<string, SQL> {
  return { count: count() };
}

// The count as a value the surrounding query can select. `count()` carries drizzle's `Number`
// decoder, but a `select` built around it decodes as the row it returns, so the mapping is
// restored here and the count comes back as a number on every dialect.
function countOf(rows: SQLWrapper): SQL<number> {
  return sql`${rows.getSQL()}`.mapWith(Number);
}
