import type { CollectionState } from '@prisma/orm-family-sql/orm-client';

// orm-client keeps `state` internal and has no public accessor for it.
export function getCollectionPaginationState(collection: unknown): {
  orderBy: readonly unknown[];
  paginated: boolean;
  distinct: boolean;
} {
  const { state } = collection as { state?: CollectionState };
  return {
    orderBy: state?.orderBy ?? [],
    paginated: state?.cursor != null || state?.limit !== undefined || state?.offset !== undefined,
    distinct: !!state?.distinct?.length || !!state?.distinctOn?.length,
  };
}

/**
 * Throws for a collection that already includes a relation. The plugin includes what the selection
 * needs, and a second include of a name loads both while the row keeps one, so the collection's own
 * include would be lost or would load rows no field reads. The types reject such a collection, but
 * not in a union with one that has no include, which TypeScript reduces to the latter.
 */
export function assertNoIncludes(collection: unknown) {
  const { state } = collection as { state?: CollectionState };
  const names = state?.includes.map((include) => `'${include.relationName}'`);
  if (names?.length) {
    throw new Error(
      `A collection returned to @pothos/plugin-prisma-next already includes ${names.join(', ')}. ` +
        "Return it without include(): the plugin includes what the query selects. Filter a relation with its field's `query` option.",
    );
  }
}
