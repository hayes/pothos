/**
 * RC22 has no public pagination, distinct or order accessor (`state` is `@internal`). Read its state only to validate
 * supplied Collections; keep this compatibility check together on ORM upgrades.
 */
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
