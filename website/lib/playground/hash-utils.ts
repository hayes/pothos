/**
 * DJB2 hash algorithm - simple, fast, and good distribution
 * Used for generating cache keys and schema identifiers
 *
 * @param str - String to hash
 * @returns Hash as base-36 string (alphanumeric)
 */
export function hashString(str: string): string {
  let hash = 5381; // DJB2 initial value

  for (let i = 0; i < str.length; i++) {
    // hash * 33 ^ char
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }

  // Convert to unsigned 32-bit integer, then to base-36 string
  return (hash >>> 0).toString(36);
}

/**
 * Generate a cache key for a schema SDL string
 *
 * @param schemaSDL - GraphQL schema SDL string
 * @returns Cache key string, or 'none' if no schema
 */
export function generateSchemaKey(schemaSDL: string | null): string {
  if (!schemaSDL) {
    return 'none';
  }
  return `schema-${hashString(schemaSDL)}`;
}
