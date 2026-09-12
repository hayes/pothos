// Internal helpers shared by the loader wrappers. Not re-exported from the package entry point.

// Resolvers for list fields are allowed to return any Iterable. Strings are deliberately excluded
// so a string returned where a list was expected is not spread into its characters, which would
// turn a wrong-shaped resolver result into plausible looking keys.
export function isIterableList(value: unknown): value is Iterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.iterator in value;
}
