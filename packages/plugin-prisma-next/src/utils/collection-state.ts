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
