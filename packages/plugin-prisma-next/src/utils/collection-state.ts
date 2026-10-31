import type { CollectionState } from '@prisma/orm-family-sql/orm-client';

// orm-client has no public accessor for this (`state` is `@internal`).
export function getCollectionPaginationState(collection: unknown): {
  ordered: boolean;
  orderBy: readonly unknown[];
  paginated: boolean;
  distinct: boolean;
} {
  const { state } = collection as { state?: CollectionState };
  return {
    ordered: !!state?.orderBy?.length,
    orderBy: state?.orderBy ?? [],
    paginated: state?.cursor != null || state?.limit !== undefined || state?.offset !== undefined,
    distinct: !!state?.distinct?.length || !!state?.distinctOn?.length,
  };
}
