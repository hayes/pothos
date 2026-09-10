import {
  and,
  getTableAsAliasSQL,
  type Relation,
  relationToSQL,
  type SQL,
  sql,
  type Table,
} from 'drizzle-orm';

export interface RelationFilter {
  /**
   * A predicate over the target table alone, for the places where only the target table is in
   * scope: a `where` handed to a user `select`, or a count that selects from the target table.
   * A many-to-many relation becomes an `exists` over the junction table, so the predicate stays
   * one row of the target at a time.
   */
  filter: SQL;
  /**
   * What a count of the rows the relation yields has to select from, and the filter that goes
   * with it. A many-to-many relation joins the junction table in, so the count matches the rows
   * the relational query builder returns for the same relation, junction duplicates included.
   */
  count: { source: Table | SQL; filter: SQL };
}

/**
 * The parent-to-child SQL for one relation, built by drizzle so the plugin agrees with the
 * relational query builder on what "related" means: `through` (many-to-many), the relation's own
 * `where`, and a reversed relation's inherited `where` all come from drizzle rather than from a
 * join reassembled here out of source and target columns.
 *
 * `parentTable` is the parent as it appears in the surrounding query, so the aliased table when
 * the query builder aliased it.
 */
export function buildRelationFilter(relation: Relation, parentTable: Table): RelationFilter {
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
    return { filter, count: { source: targetTable, filter } };
  }

  return {
    filter: sql`exists (select 1 from ${getTableAsAliasSQL(throughTable)} where ${and(filter, joinCondition)})`,
    count: {
      source: sql`${getTableAsAliasSQL(targetTable)} inner join ${getTableAsAliasSQL(throughTable)} on ${joinCondition}`,
      filter,
    },
  };
}
