import {
  and,
  type Column,
  count,
  countDistinct,
  exists,
  type Relation,
  relationToSQL,
  type SQL,
  type SQLWrapper,
  sql,
  type Table,
} from 'drizzle-orm';

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
   * A many-to-many relation becomes an `exists` over the junction table, so the predicate stays
   * one row of the target at a time.
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
   * This exists because the alternative — counting the target table filtered by `filter` — asks
   * sqlite to scan the whole target table once per parent row: sqlite does not rewrite the
   * `exists` into a semijoin the way postgres does, so a relation the join reads in microseconds
   * takes a second over a thousand parents.
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
 * Nothing here writes SQL text either: `relationToSQL` produces the correlations, and the
 * `exists` and the junction join are drizzle's own `exists` operator and core query builder, so
 * they emit the same SQL the relational query builder emits for the same relation.
 *
 * `parentTable` is the parent as it appears in the surrounding query, so the aliased table when
 * the query builder aliased it.
 */
export function buildRelationFilter(
  client: RelationQueryBuilder,
  relation: Relation,
  parentTable: Table,
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
    // An `exists` over the junction alone: the target row is already in scope in the query this
    // predicate goes into, so the junction is all the subquery has to look at.
    filter: exists(client.select(one).from(throughTable).where(and(filter, joinCondition))),
    countRows: (where) => relatedRows(countStar(), where),
    countDistinctRows: (key, where) => relatedRows({ count: countDistinct(key) }, where),
  };
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
