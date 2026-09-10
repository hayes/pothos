import { createContextCache, PothosValidationError } from '@pothos/core';
import {
  type Adapter,
  type EntryVisitor,
  type Node,
  type Plan,
  type QueryFormat,
  type SelectFn,
  treeAccumulator,
} from '@pothos/selection-mapper';
import type { TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLNamedType } from 'graphql';
import type { DrizzleFieldSelection } from '../types.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import { omitUndefinedKeys, type SelectionMap } from './selections.js';

export type DrizzleNode = Node<TableRelationalConfig>;
export type DrizzlePlan = Plan<TableRelationalConfig, SelectionMap>;
export type DrizzleAdapter = Adapter<TableRelationalConfig, SelectionMap>;

/** A map without `columns`: every column. Shared and never mutated. */
const ALL: SelectionMap = Object.freeze({});

/**
 * How drizzle selections (`DBQueryConfig`: `columns`, `with`, `extras` and query arguments) read
 * onto the shared query tree, and how a node is written back, for one schema config. A node
 * whose columns are `null` selects every column; a named-column node always adds the table's
 * primary key so rows can be matched back to their parent.
 *
 * The merge, compare and conflict rules are the package's: this is the key loop and `serialize`.
 */
function drizzleFormat(
  config: PothosDrizzleSchemaConfig,
): QueryFormat<TableRelationalConfig, SelectionMap> {
  const format: QueryFormat<TableRelationalConfig, SelectionMap> = {
    read({ columns, with: withSelection, extras, ...args }, model, visit) {
      readRelations(withSelection, model, config, visit);
      visit.args(omitUndefinedKeys(args));

      for (const key of Object.keys(extras ?? {})) {
        visit.extra(key, extras![key]);
      }

      if (!columns) {
        // No `columns` means every column, which is final (S-9).
        visit.allColumns();

        return;
      }

      for (const key of Object.keys(columns)) {
        if (columns[key]) {
          visit.column(key);
        }
      }
    },
    // Extras are functions, compared by identity: the default deep-equal would let two different
    // functions computing the same shape merge.
    extraConflicts: (extras, name, value) => extras.has(name) && extras.get(name) !== value,
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
        query.with[key] = format.serialize(child);
      }

      return query;
    },
  };

  return format;
}

/** M-1: the entries of a `with` map, resolved to the tables they target. */
function readRelations(
  withSelection: Record<string, unknown> | undefined,
  model: TableRelationalConfig,
  config: PothosDrizzleSchemaConfig,
  visit: EntryVisitor<TableRelationalConfig, SelectionMap>,
) {
  for (const key of Object.keys(withSelection ?? {})) {
    const value = withSelection![key];

    if (!value) {
      continue;
    }

    const relationConfig = model.relations[key];

    if (!relationConfig) {
      throw new PothosValidationError(`Relation ${key} does not exist on ${model.name}`);
    }

    visit.relation(
      key,
      config.relations[relationConfig.targetTableName],
      value === true ? ALL : (value as SelectionMap),
    );
  }
}

export const drizzleAdapter = createContextCache(
  (config: PothosDrizzleSchemaConfig): DrizzleAdapter => ({
    skipDeferredFragments: config.skipDeferredFragments,
    // Set by drizzleObject/drizzleInterface and propagated to implementing types by onTypeConfig.
    modelFor: (type) => type.extensions?.pothosDrizzleTable as TableRelationalConfig | undefined,
    typeSelection(type) {
      // schema-builder stores `{ columns: {}, ...select }`, or `true` for every column.
      const selection = type.extensions?.pothosDrizzleSelect as SelectionMap | true | undefined;

      return selection === true ? ALL : selection || undefined;
    },
    fieldSelection: (field) =>
      ((field.extensions?.pothosDrizzleSelect as DrizzleFieldSelection | false | undefined) ||
        undefined) as SelectionMap | SelectFn<SelectionMap> | undefined,
    accumulator: treeAccumulator(drizzleFormat(config)),
  }),
);

export type { GraphQLNamedType };
