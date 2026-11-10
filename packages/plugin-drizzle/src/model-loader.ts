import { createContextCache, isThenable, type MaybePromise, type SchemaTypes } from '@pothos/core';
import {
  fieldKey,
  forExecution,
  Plan,
  setLoaderMappings,
  setRowFieldMapping,
} from '@pothos/selection-mapper';
import {
  type AnyTable,
  type Column,
  getColumns,
  inArray,
  type SQL,
  sql,
  type Table,
  type TableRelationalConfig,
} from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import {
  type DrizzleAdapter,
  type DrizzleNode,
  type DrizzlePlan,
  type DrizzlePlayedPlan,
  drizzleAdapter,
} from './utils/adapter.js';
import { getClient, getSchemaConfig, type PothosDrizzleSchemaConfig } from './utils/config.js';
import { InternalError } from './utils/errors.js';
import { planFromInfo } from './utils/map-query.js';
import { setPlannedPosition } from './utils/path-info.js';
import type { SelectionMap } from './utils/selections.js';

/** A load found no row for the key. A node load resolves `null` for it; a reload raises it. */
class MissingRowError extends InternalError {}

interface ResolvablePromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

export class ModelLoader {
  context: object;

  builder: PothosSchemaTypes.SchemaBuilder<never>;

  modelName: string;

  // One plan per `fieldKey` per execution, a promise while a select beneath the field is async.
  // A parent-row plan is played where it is made, since it is never played behind another
  // selection; a field's plan is played per load, so no two loads share a node. Kept per
  // execution (see `forExecution`), so neither an operation sharing the context nor a later
  // subscription event loads with another's plan.
  rowCache = new WeakMap<object, Map<string, MaybePromise<DrizzlePlayedPlan>>>();

  planCache = new WeakMap<object, Map<string, MaybePromise<DrizzlePlan>>>();

  // Each batch owns the node it accumulates into, so nothing a cached plan or play holds is
  // changed by a row joining the batch.
  staged = new Set<{
    root: DrizzleNode;
    models: Map<object, ResolvablePromise<Record<string, unknown> | null>>;
  }>();

  config: PothosDrizzleSchemaConfig;
  adapter: DrizzleAdapter;
  table: TableRelationalConfig;
  columns: Column[];
  primaryKey: Column[];
  selectSQL: (table: AnyTable<{}>) => SQL;

  constructor(
    context: object,
    builder: PothosSchemaTypes.SchemaBuilder<never>,
    modelName: string,
    columns?: Column[],
  ) {
    this.context = context;
    this.builder = builder;
    this.modelName = modelName;
    this.config = getSchemaConfig(builder);
    this.adapter = drizzleAdapter(this.config);
    this.table = this.config.relations[modelName];
    this.primaryKey = this.config.getPrimaryKey(modelName);
    this.columns = columns ?? this.primaryKey;
    this.selectSQL = (table) => {
      const columns = this.columns.map((column) =>
        Object.values(getColumns(table)).find(
          (tblColumn) => 'columnType' in tblColumn && tblColumn.name === column.name,
        ),
      );
      return columns.length > 1 ? sql`(${sql.join(columns, sql`, `)})` : columns[0]!.getSQL();
    };
  }

  static forModel<Types extends SchemaTypes>(
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    columns?: Column[],
  ) {
    return createContextCache(
      (model) => new ModelLoader(model, builder as never, modelName, columns),
    );
  }

  sqlForModel(model: object) {
    const values = this.columns.map((key) => {
      const columnName = this.config.columnToTsName(key) as keyof typeof model;
      if (columnName in model) {
        return model[columnName] as string | number;
      }

      throw new Error(`Primary key column ${columnName} not found on ${this.modelName}`);
    });

    return this.columns.length > 1 ? values : values[0];
  }

  getSelection(info: GraphQLResolveInfo) {
    const plans = forExecution(this.rowCache, info);
    const key = fieldKey(info.parentType.name, info);
    let plan = plans.get(key);
    if (!plan) {
      plan = Plan.forParentRow(drizzleAdapter(this.config), { context: this.context, info });
      plans.set(key, plan);
    }

    return plan;
  }

  getSelectionForField(info: GraphQLResolveInfo, typeName: string) {
    const plans = forExecution(this.planCache, info);
    // Keyed on the parent type too, which the plan's root position is under.
    const key = `${typeName}:${fieldKey(info.parentType.name, info)}`;
    let plan = plans.get(key);
    if (!plan) {
      // Walked without paths, so there is always a plan.
      plan = planFromInfo({ config: this.config, context: this.context, info, typeName })!;
      plans.set(key, plan);
    }

    return plan;
  }

  /**
   * `model` reloaded with the selection of the field `info` resolves. A synchronous selection
   * stages synchronously, so every row resolved in a tick joins the same batch; only a selection
   * with an async select beneath the field waits for it.
   */
  loadSelection(info: GraphQLResolveInfo, model: object): Promise<Record<string, unknown> | null> {
    const selection = this.getSelection(info);

    return isThenable(selection)
      ? selection.then((settled) => this.loadWith(settled, info, model))
      : this.loadWith(selection, info, model);
  }

  private loadWith(played: DrizzlePlayedPlan, info: GraphQLResolveInfo, model: object) {
    return this.stageQuery(played, model).then((result) => {
      if (result) {
        const mapping = played.mappings[`${info.parentType.name}@${info.path.key}`];

        // The field's resolver pages with the position of this load, not the one its parent was
        // planned at.
        setPlannedPosition(info.path, mapping?.position);

        if (mapping) {
          // Recorded for the field itself too, so its resolver finds the pathInfo it was planned
          // with, along with the mappings of the fields beneath it. Against `result` alone: this
          // load fetched one row, so the field's own mapping answers for that row's lookup only.
          setRowFieldMapping(this.context, info, mapping, result);
        }
      }

      return result;
    });
  }

  /** A node loaded by id with the selection beneath the field `info` resolves, as `returnType`. */
  loadSelectionForField(
    info: GraphQLResolveInfo,
    model: object,
    returnType: string,
  ): Promise<Record<string, unknown> | null> {
    const selection = this.getSelectionForField(info, returnType);

    return isThenable(selection)
      ? selection.then((settled) => this.loadFieldWith(settled.play(), info, model))
      : this.loadFieldWith(selection.play(), info, model);
  }

  private loadFieldWith(played: DrizzlePlayedPlan, info: GraphQLResolveInfo, model: object) {
    return this.stageQuery(played, model).then(
      (result) => {
        // Relay nodes of different types share this field path. Each node plan contributes
        // its type-qualified mappings, as a queryFromInfo plan would.
        setLoaderMappings(this.context, info, played.mappings);

        return result;
      },
      (error: unknown) => {
        if (error instanceof MissingRowError) {
          return null;
        }

        throw error;
      },
    );
  }

  stageQuery(played: Pick<DrizzlePlayedPlan, 'root'>, model: object) {
    for (const entry of this.staged) {
      // Node to node: the batch takes the field's play whole, never through a query.
      if (this.adapter.canMergeNode(entry.root, played.root)) {
        this.adapter.mergeNode(entry.root, played.root);

        if (!entry.models.has(model)) {
          entry.models.set(model, createResolvablePromise<Record<string, unknown> | null>());
        }

        return entry.models.get(model)!.promise;
      }
    }

    return this.initLoad(played, model);
  }

  initLoad(played: Pick<DrizzlePlayedPlan, 'root'>, model: object) {
    const promise = createResolvablePromise<Record<string, unknown> | null>();
    const root = this.adapter.createNode(played.root.model);

    this.adapter.mergeNode(root, played.root);

    const entry = {
      root,
      models: new Map([[model, promise]]),
    };
    this.staged.add(entry);

    const nextTick = createResolvablePromise<void>();
    const client = getClient(this.builder, this.context);

    nextTick.promise
      .then(() => {
        this.staged.delete(entry);
        const api = client.query[this.modelName];

        const query = api.findMany({
          ...this.adapter.toQuery(entry.root),
          where: {
            RAW: (table: AnyTable<{}>) =>
              inArray(
                this.selectSQL(table),
                [...entry.models.keys()].map((model) => this.sqlForModel(model)),
              ),
          },
        } as never);

        query.then(
          (results) => {
            for (const [model, promise] of entry.models.entries()) {
              // Matched on the columns the batch was keyed by, which are the columns a row of
              // `entry.models` carries: a node loaded by a column other than the primary key
              // has only that one.
              const result = results.find((row) =>
                this.columns.every((key) => {
                  const name = this.config.columnToTsName(key);
                  const actual = row[name as keyof typeof row];
                  const expected = (model as Record<string, unknown>)[name];

                  return (
                    actual === expected ||
                    (actual instanceof Uint8Array &&
                      expected instanceof Uint8Array &&
                      actual.length === expected.length &&
                      actual.every((byte, index) => byte === expected[index])) ||
                    (actual instanceof Date &&
                      expected instanceof Date &&
                      actual.getTime() === expected.getTime())
                  );
                }),
              );

              if (result) {
                promise.resolve(result);
              } else {
                promise.reject(
                  new MissingRowError(
                    `Model ${this.modelName}(${String(this.sqlForModel(model))}) not found`,
                  ),
                );
              }
            }
          },
          (err) => {
            for (const promise of entry.models.values()) {
              promise.reject(err);
            }
          },
        );
      })
      .catch((err) => {
        for (const promise of entry.models.values()) {
          promise.reject(err);
        }
      });

    setTimeout(() => nextTick.resolve(), 0);

    return promise.promise;
  }
}

/** Matches `ScopeAuthParentLoader` in @pothos/plugin-scope-auth, which this plugin can't import. */
type ScopeAuthParentLoader = (
  parent: unknown,
  context: object,
  info: GraphQLResolveInfo,
) => MaybePromise<unknown>;

/**
 * The parent scope-auth's checks see for a type: the row when it has every top-level key of the
 * type's selection, otherwise the row reloaded with it.
 */
export function typeParentLoader(
  loaders: (context: object) => ModelLoader,
  adapter: DrizzleAdapter,
  table: TableRelationalConfig,
  selection: SelectionMap,
): ScopeAuthParentLoader {
  const root = adapter.createNode(table);
  adapter.mergeQuery(root, selection);
  // Read from the node, which resolves a `columns` map that only excludes. A node without columns
  // selects every column.
  const keys = [
    ...(root.columns ?? Object.keys(getColumns(table.table as Table))),
    ...root.relations.keys(),
    ...root.computed.keys(),
  ];

  // By root field path, which graphql makes for each root field of each execution, then row.
  const loads = new WeakMap<GraphQLResolveInfo['path'], WeakMap<object, Promise<object>>>();
  const reload = (row: Record<string, unknown>, context: object, info: GraphQLResolveInfo) => {
    let path = info.path;

    while (path.prev) {
      path = path.prev;
    }

    let rows = loads.get(path);

    if (!rows) {
      rows = new WeakMap();
      loads.set(path, rows);
    }

    let load = rows.get(row);

    if (!load) {
      load = new Promise<Record<string, unknown> | null>((resolve) => {
        resolve(loaders(context).stageQuery({ root }, row));
      })
        .then((loaded) => {
          // Loaded values win for the selection's keys. The row's other keys are kept.
          const merged = { ...row };

          for (const key of keys) {
            merged[key] = loaded![key];
          }

          return merged;
        })
        .catch((error: unknown) => {
          // Clients see only a generic message.
          throw error instanceof InternalError
            ? error
            : new Error('Unexpected error.', { cause: error });
        });
      rows.set(row, load);
    }

    return load;
  };

  return (parent, context, info) => {
    const row = parent as Record<string, unknown>;

    for (let i = 0; i < keys.length; i += 1) {
      if (row[keys[i]] === undefined) {
        return reload(row, context, info);
      }
    }

    return row;
  };
}

function createResolvablePromise<T = unknown>(): ResolvablePromise<T> {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return { promise, resolve: resolveFn, reject: rejectFn };
}
