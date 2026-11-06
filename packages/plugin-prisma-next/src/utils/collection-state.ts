import type { CollectionState } from '@prisma/orm-family-sql/orm-client';
import { InternalError } from './errors.js';

/**
 * Throws for a collection a connection resolver returned that is already ordered, limited,
 * distinct or including a relation. The connection orders, filters past the cursor and limits it,
 * and the plugin includes what the selection needs, so such a collection would page silently
 * wrong. orm-client keeps `state` internal and has no public accessor for it.
 */
export function assertConnectionCollection(collection: unknown): void {
  const { state } = collection as { state?: CollectionState };
  if (!state) {
    return;
  }
  const names = state.includes.map((include) => `'${include.relationName}'`);
  if (names.length) {
    throw new InternalError(
      `A collection returned to @pothos/plugin-prisma-next already includes ${names.join(', ')}. ` +
        "Return it without include(): the plugin includes what the query selects. Filter a relation with its field's `query` option.",
    );
  }
  if (
    state.orderBy?.length ||
    state.cursor != null ||
    state.limit !== undefined ||
    state.offset !== undefined
  ) {
    throw new InternalError(
      "Connection resolvers must return an unordered, unpaginated Collection without orderBy(), cursor(), limit(), or offset(). Order it with the connection's query: { orderBy }.",
    );
  }
  if (state.distinct?.length || state.distinctOn?.length) {
    throw new InternalError(
      'Connection resolvers cannot return a Collection with distinct() or distinctOn(): the rows a page keeps would depend on the columns the selection adds.',
    );
  }
}
