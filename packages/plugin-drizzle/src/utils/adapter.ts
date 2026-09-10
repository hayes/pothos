import { createContextCache, PothosValidationError } from '@pothos/core';
import {
  type Adapter,
  createNode,
  deepEqual,
  type Node,
  relation,
  type SelectFn,
  type Walk,
} from '@pothos/selection-mapper';
import type { TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLNamedType } from 'graphql';
import type { DrizzleFieldSelection } from '../types.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import { omitUndefinedKeys, type SelectionMap } from './selections.js';

export type DrizzleNode = Node<TableRelationalConfig>;
export type DrizzleWalk = Walk<TableRelationalConfig, SelectionMap>;
export type DrizzleAdapter = Adapter<TableRelationalConfig, SelectionMap>;

/** A map without `columns`: every column. Shared and never mutated. */
const ALL: SelectionMap = Object.freeze({});

/**
 * How drizzle selections (`DBQueryConfig`: `columns`, `with`, `extras` and query arguments) map
 * onto the shared query tree, for one schema config. A node whose columns are `null` selects
 * every column; a named-column node always adds the table's primary key so rows can be matched
 * back to their parent.
 */
export const drizzleAdapter = createContextCache(
  (config: PothosDrizzleSchemaConfig): DrizzleAdapter => {
    const adapter: DrizzleAdapter = {
      skipDeferredFragments: config.skipDeferredFragments,
      // Set by drizzleObject/drizzleInterface and propagated to implementing types by onTypeConfig.
      modelFor: (type) => type.extensions?.pothosDrizzleTable as TableRelationalConfig | undefined,
      createNode,
      typeSelection(type) {
        // schema-builder stores `{ columns: {}, ...select }`, or `true` for every column.
        const selection = type.extensions?.pothosDrizzleSelect as SelectionMap | true | undefined;

        return selection === true ? ALL : selection || undefined;
      },
      fieldSelection: (field) =>
        ((field.extensions?.pothosDrizzleSelect as DrizzleFieldSelection | false | undefined) ||
          undefined) as SelectionMap | SelectFn<SelectionMap> | undefined,
      merge(node, { columns, with: withSelection, extras, ...args }) {
        for (const key of Object.keys(withSelection ?? {})) {
          const value = withSelection![key];

          if (!value) {
            continue;
          }

          const relationConfig = node.model.relations[key];

          if (!relationConfig) {
            throw new PothosValidationError(`Relation ${key} does not exist on ${node.model.name}`);
          }

          adapter.merge(
            relation(node, key, config.relations[relationConfig.targetTableName], value),
            value === true ? ALL : (value as SelectionMap),
          );
        }

        const query = omitUndefinedKeys(args);

        if (Object.keys(query).length > 0) {
          node.args = query;
        }

        for (const key of Object.keys(extras ?? {})) {
          node.extras.set(key, extras![key]);
        }

        // Every column is final (S-9).
        if (node.columns === null) {
          return;
        }

        if (columns) {
          for (const key of Object.keys(columns)) {
            if (columns[key]) {
              node.columns.add(key);
            }
          }
        } else {
          node.columns = null;
        }
      },
      // A relation query merges over `{ columns: {} }`: without `columns` of its own it adds no
      // columns, so it never means "every column".
      mergeQuery(node, query) {
        if (query && Object.keys(query).length > 0) {
          adapter.merge(node, { columns: {}, ...query });
        }
      },
      compatible(node, { with: withSelection, extras, columns: _columns, ...args }, ignoreArgs) {
        for (const key of Object.keys(withSelection ?? {})) {
          const value = withSelection![key];
          const child = node.relations.get(key);

          if (
            value &&
            child &&
            !adapter.compatible(child, value === true ? ALL : (value as SelectionMap), false)
          ) {
            return false;
          }
        }

        // Extras are functions, compared by identity.
        for (const key of Object.keys(extras ?? {})) {
          if (node.extras.has(key) && node.extras.get(key) !== extras![key]) {
            return false;
          }
        }

        return ignoreArgs || deepEqual(node.args, omitUndefinedKeys(args));
      },
      typeLevelConflict(node, { with: withSelection, extras }) {
        const relationName = Object.keys(withSelection ?? {}).find(
          (key) =>
            !adapter.compatible(node, { columns: {}, with: { [key]: withSelection![key] } }, true),
        );

        if (relationName !== undefined) {
          return { kind: 'relation', name: relationName };
        }

        const extra = Object.keys(extras ?? {}).find(
          (key) =>
            !adapter.compatible(node, { columns: {}, extras: { [key]: extras![key] } }, true),
        );

        return extra === undefined ? undefined : { kind: 'extra', name: extra };
      },
      withoutConflicts(node, { with: withSelection, extras, ...rest }) {
        return {
          ...rest,
          with:
            withSelection &&
            compatibleEntries(withSelection, (entry) =>
              adapter.compatible(node, { columns: {}, with: entry }, true),
            ),
          extras:
            extras &&
            compatibleEntries(extras, (entry) =>
              adapter.compatible(node, { columns: {}, extras: entry }, true),
            ),
        };
      },
      serialize(node) {
        // `columns` stays present (as undefined) for an every-column node: it is what callers
        // spreading or comparing the query have always seen.
        const query: SelectionMap & {
          with: Record<string, unknown>;
          extras: Record<string, unknown>;
        } = { ...node.args, columns: undefined, with: {}, extras: {} };

        if (node.columns) {
          query.columns = {};

          for (const column of node.columns) {
            query.columns[column] = true;
          }

          for (const column of config.getPrimaryKey(node.model.name)) {
            query.columns[config.columnToTsName(column)] = true;
          }
        }

        for (const [key, value] of node.extras) {
          query.extras[key] = value as never;
        }

        for (const [key, child] of node.relations) {
          query.with[key] = adapter.serialize(child);
        }

        return query;
      },
    };

    return adapter;
  },
);

function compatibleEntries<T extends object>(map: T, compatible: (entry: T) => boolean): T {
  return Object.fromEntries(
    Object.entries(map).filter(([key, value]) => compatible({ [key]: value } as T)),
  ) as T;
}

export type { GraphQLNamedType };
