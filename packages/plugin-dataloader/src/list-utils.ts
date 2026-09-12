/** Internal list helpers shared by the loader wrappers. */

// Strings are excluded: a string in a list position must not be spread into its characters.
export function isIterableList(value: unknown): value is Iterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.iterator in value;
}
