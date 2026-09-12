import { createContextCache, PothosValidationError } from '@pothos/core';
import {
  type Node,
  NodeAdapter,
  type Plan,
  type PlayedPlan,
  type QueryVisitor,
  type SelectFn,
} from '@pothos/selection-mapper';
import { getColumns, type Table, type TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLField, GraphQLNamedType } from 'graphql';
import type { DrizzleFieldSelection, PathInfo } from '../types.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import { pathInfoFor } from './path-info.js';
import { omitUndefinedKeys, type SelectionMap } from './selections.js';

export type DrizzleNode = Node<TableRelationalConfig>;
export type DrizzlePlan = Plan<TableRelationalConfig, SelectionMap>;
export type DrizzlePlayedPlan = PlayedPlan<TableRelationalConfig, SelectionMap>;
type DrizzleVisitor = QueryVisitor<TableRelationalConfig, SelectionMap>;

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

  private readonly fieldSelections = new WeakMap<
    GraphQLField<unknown, unknown>,
    SelectFn<SelectionMap>
  >();

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
    const selection = field.extensions?.pothosDrizzleSelect as DrizzleFieldSelection | undefined;
    if (typeof selection !== 'function') {
      return selection || undefined;
    }

    let compiled = this.fieldSelections.get(field);
    if (!compiled) {
      compiled = (args, context, nested, selected, position) => {
        // Keep the public metadata at the adapter boundary. Static query objects do not need
        // either path array; callbacks that inspect metadata build them once per invocation.
        let resolvedPath: PathInfo | undefined;
        const pathInfo: PathInfo = {
          get path() {
            resolvedPath ??= pathInfoFor(position)!;
            return resolvedPath.path;
          },
          get segments() {
            resolvedPath ??= pathInfoFor(position)!;
            return resolvedPath.segments;
          },
        };
        return selection(
          args,
          context,
          (query, path, type) =>
            nested(
              // The public API also accepts false, which the walker treats as an empty seed.
              (typeof query === 'function' ? query(args, context, pathInfo) : query) as Parameters<
                typeof nested
              >[0],
              path,
              type,
            ),
          selected,
          pathInfo,
        );
      };
      this.fieldSelections.set(field, compiled);
    }
    return compiled;
  }

  visitQuery(
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
      // No `columns` means every column, which a node never goes back from.
      visit.allColumns();

      return;
    }

    const entries = Object.entries(columns).filter(([, value]) => value !== undefined);

    // Drizzle picks its selection mode from the first defined entry: naming any column `true`
    // makes the map an inclusion list, while a map whose entries are all `false` excludes those
    // columns from every other one. The node tracks named columns, so expand the exclusion.
    if (entries.length > 0 && entries.every(([, value]) => !value)) {
      const excluded = new Set(entries.map(([key]) => key));

      for (const key of Object.keys(getColumns(model.table as Table))) {
        if (!excluded.has(key)) {
          visit.column(key);
        }
      }

      return;
    }

    for (const [key, value] of entries) {
      if (value) {
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

  /** The keys of a `with` map, resolved to the tables they target. */
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
