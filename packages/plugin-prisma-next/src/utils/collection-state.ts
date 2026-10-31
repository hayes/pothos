// orm-client has no public accessor for this (`state` is `@internal`).
export function getCollectionPaginationState(collection: unknown): {
  ordered: boolean;
  orderBy: readonly unknown[];
  paginated: boolean;
  distinct: boolean;
} {
  const state = (
    collection as {
      state?: {
        orderBy?: readonly unknown[];
        cursor?: unknown;
        limit?: unknown;
        offset?: unknown;
        distinct?: readonly string[];
        distinctOn?: readonly string[];
      };
    }
  ).state;
  return {
    ordered: !!state?.orderBy?.length,
    orderBy: state?.orderBy ?? [],
    paginated: state?.cursor != null || state?.limit !== undefined || state?.offset !== undefined,
    distinct: !!state?.distinct?.length || !!state?.distinctOn?.length,
  };
}
