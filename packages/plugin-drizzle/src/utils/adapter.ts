import { createContextCache, PothosValidationError } from '@pothos/core';
import {
  type EntryVisitor,
  type Node,
  NodeAdapter,
  type Plan,
  type PlayedPlan,
  type SelectFn,
} from '@pothos/selection-mapper';
import type { TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLField, GraphQLNamedType } from 'graphql';
import type { DrizzleFieldSelection } from '../types.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import { omitUndefinedKeys, type SelectionMap } from './selections.js';

export type DrizzleNode = Node<TableRelationalConfig>;
export type DrizzlePlan = Plan<TableRelationalConfig, SelectionMap>;
export type DrizzlePlayedPlan = PlayedPlan<TableRelationalConfig, SelectionMap>;
type DrizzleVisitor = EntryVisitor<TableRelationalConfig, SelectionMap>;

/** A map without `columns`: every column. Shared and never mutated. */
const ALL: SelectionMap = Object.freeze({});

/**
 * How drizzle selections (`DBQueryConfig`: `columns`, `with`, `extras` and query arguments) read
 * onto the shared query tree, and how a node is written back. A node whose columns are `null`
 * selects every column; a named-column node always adds the table's primary key so rows can be
 * matched back to their parent.
 *
 * The merge, compare and conflict rules are `NodeAdapter`'s: this is the schema side, the key
 * loop and `toQuery`. The schema config every one of them needs is the adapter's own state.
 */
export class DrizzleAdapter extends NodeAdapter<TableRelationalConfig, SelectionMap> {
  override skipDeferredFragments: boolean;

  constructor(private readonly config: PothosDrizzleSchemaConfig) {
    super();
    this.skipDeferredFragments = config.skipDeferredFragments;
  }

  // Set by drizzleObject/drizzleInterface and propagated to implementing types by onTypeConfig.
  modelFor(type: GraphQLNamedType) {
    return type.extensions?.pothosDrizzleTable as TableRelationalConfig | undefined;
  }

  typeSelection(type: GraphQLNamedType) {
    // schema-builder stores `{ columns: {}, ...select }`, or `true` for every column.
    const selection = type.extensions?.pothosDrizzleSelect as SelectionMap | true | undefined;

    return selection === true ? ALL : selection || undefined;
  }

  fieldSelection(field: GraphQLField<unknown, unknown>) {
    return ((field.extensions?.pothosDrizzleSelect as DrizzleFieldSelection | false | undefined) ||
      undefined) as SelectionMap | SelectFn<SelectionMap> | undefined;
  }

  eachEntry(
    { columns, with: withSelection, extras, ...args }: SelectionMap,
    model: TableRelationalConfig,
    visit: DrizzleVisitor,
  ) {
    this.readRelations(withSelection, model, visit);
    visit.args(omitUndefinedKeys(args));

    for (const key of Object.keys(extras ?? {})) {
      visit.computed(key, extras![key]);
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
  }

  /**
   * Drizzle's `extras` are functions, compared by identity: the inherited deep-equal would let
   * two different functions computing the same shape merge.
   */
  override computedConflicts(computed: ReadonlyMap<string, unknown>, name: string, value: unknown) {
    return computed.has(name) && computed.get(name) !== value;
  }

  toQuery(node: DrizzleNode): SelectionMap {
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

      for (const column of this.config.getPrimaryKey(node.model.name)) {
        query.columns[this.config.columnToTsName(column)] = true;
      }
    }

    for (const [key, value] of node.computed) {
      query.extras[key] = value as never;
    }

    for (const [key, child] of node.relations) {
      query.with[key] = this.toQuery(child);
    }

    return query;
  }

  /** M-1: the entries of a `with` map, resolved to the tables they target. */
  private readRelations(
    withSelection: Record<string, unknown> | undefined,
    model: TableRelationalConfig,
    visit: DrizzleVisitor,
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
        this.config.relations[relationConfig.targetTableName],
        value === true ? ALL : (value as SelectionMap),
      );
    }
  }
}

export const drizzleAdapter = createContextCache(
  (config: PothosDrizzleSchemaConfig) => new DrizzleAdapter(config),
);
