/**
 * The count a `relatedConnection` selects for `totalCount` and the query that pages the relation
 * are two predicates that have to agree, and a predicate written twice is a predicate that drifts.
 * They are not written twice: both come from drizzle's `relationToSQL` and `relationsFilterToSQL`,
 * combined in the same order, so the count's `from` and `where` are the page query's `from` and
 * `where` minus the limit, the ordering and the keyset clauses.
 *
 * The one thing that does differ is the table aliases, and it has to: the relational query builder
 * names the relation's target `d<depth>` and its junction table `tr<depth>` inside the subquery it
 * pages with, while the count selects from the tables under their own names. Aliases are scope
 * names, so two different scopes cannot share them.
 *
 * Postgres numbers its placeholders by position across the whole statement, so the count's `$1`
 * is the page query's `$3`. That is the dialect numbering parameters, not the predicate differing,
 * so the placeholders are normalized away too.
 *
 * These helpers pull the two out of an emitted statement and rename one to the other, so a test
 * can assert what is left is the same text.
 */

/** Placeholders as sqlite writes them, so a postgres statement compares like a sqlite one. */
export function withoutPlaceholderNumbers(sql: string): string {
  return sql.replaceAll(/\$\d+/g, '?');
}

/** The `(select count(*) ...)` a `relatedConnection` selects, without its wrapping parens. */
export function countSubquery(statement: string): string {
  const start = statement.indexOf('(select count(*) ');

  if (start < 0) {
    throw new Error(`no count subquery in: ${statement}`);
  }

  let depth = 0;

  for (let index = start; index < statement.length; index++) {
    if (statement[index] === '(') {
      depth++;
    } else if (statement[index] === ')') {
      depth--;

      if (depth === 0) {
        return statement.slice(start + 1, index);
      }
    }
  }

  throw new Error(`unbalanced count subquery in: ${statement}`);
}

/**
 * The count's `from ... where ...`, renamed to the aliases the relational query builder pages
 * with. `target` is the relation's target table and `through` its junction table, if it has one.
 */
export function asPagedAliases(
  countSql: string,
  { target, through }: { target: string; through?: string },
): string {
  const fromWhere = countSql.slice(countSql.indexOf('from '));
  const withTargetAlias = through
    ? fromWhere
        .replace(
          `from "${target}" inner join "${through}" on `,
          `from "${target}" as "d1" inner join "${through}" as "tr0" on `,
        )
        .replaceAll(`"${through}".`, '"tr0".')
    : fromWhere.replace(`from "${target}" `, `from "${target}" as "d1" `);

  return withTargetAlias.replaceAll(`"${target}".`, '"d1".');
}
