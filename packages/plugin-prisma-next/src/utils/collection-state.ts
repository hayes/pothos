/**
 * RC9 has no public pagination/order reset. Read its state only to validate
 * supplied Collections; keep this compatibility check together on ORM upgrades.
 */
export function getCollectionPaginationState(collection: unknown): {
  ordered: boolean;
  paginated: boolean;
} {
  const state = (
    collection as {
      state?: {
        orderBy?: readonly unknown[];
        cursor?: unknown;
        limit?: number;
        offset?: number;
      };
    }
  ).state;
  return {
    ordered: !!state?.orderBy?.length,
    paginated: state?.cursor != null || state?.limit !== undefined || state?.offset !== undefined,
  };
}
