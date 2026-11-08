/*
 * In a selection, a to-many relation is keyed `relation:id` and a value computed from it
 * `relation:id:key`, so each consumer gets its own `combine()` branch. A branch is named `n/ids`
 * for rows and `n/ids:key` for a computed value, where `n` is unique in the statement and `ids` are
 * the ids of the consumers sharing it, a field consumer's as its load id (see load-ids.ts), joined
 * with a space. A value only the consumer's field
 * reads, rather than its parent, has a key starting with the separator (`fieldOnlyKey`).
 */

const KEY_SEPARATOR = ':';
const ID_SEPARATOR = ' ';

/** The key of a computed value only the consumer's field reads, not written onto the parent. */
export function fieldOnlyKey(name: string) {
  return `${KEY_SEPARATOR}${name}`;
}

/** Whether a computed value's key is one `fieldOnlyKey` made. */
export function isFieldOnlyKey(key: string) {
  return key.startsWith(KEY_SEPARATOR);
}

/** The selection key a consumer uses for a to-many relation's rows. */
export function rowsKey(relation: string, id: string) {
  return `${relation}${KEY_SEPARATOR}${id}`;
}

/** The selection key a consumer uses for value `key` computed from a to-many relation. */
export function valueKey(relation: string, id: string, key: string) {
  return `${rowsKey(relation, id)}${KEY_SEPARATOR}${key}`;
}

/** The relation a selection key refers to. */
export function relationName(key: string) {
  const separator = key.indexOf(KEY_SEPARATOR);
  return separator < 0 ? key : key.slice(0, separator);
}

/** The consumer id of a to-many relation's selection key. */
export function consumerOfKey(key: string) {
  const rest = key.slice(relationName(key).length + 1);
  const separator = rest.indexOf(KEY_SEPARATOR);
  return separator < 0 ? rest : rest.slice(0, separator);
}

/** The name of `combine()` branch `n`, of rows or of value `key`, which consumers `ids` share. */
export function branchName(n: number, ids: readonly string[], key?: string) {
  return `${n}/${ids.join(ID_SEPARATOR)}${key === undefined ? '' : `${KEY_SEPARATOR}${key}`}`;
}

/** What `branchName` named: the ids, and the key of a value's branch. */
export function parseBranch(name: string): { ids: string[]; key?: string } {
  // The number only keeps the ORM's aliases apart.
  const named = name.slice(name.indexOf('/') + 1);
  const separator = named.indexOf(KEY_SEPARATOR);
  return separator < 0
    ? { ids: named.split(ID_SEPARATOR) }
    : { ids: named.slice(0, separator).split(ID_SEPARATOR), key: named.slice(separator + 1) };
}
