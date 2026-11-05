import {
  completeValue,
  type FieldMap,
  type InputFieldMap,
  type InputShapeFromFields,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import type { Position } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { TotalCountFlag } from './types/aggregates.js';
import type { CollectionFor, ResolverCollection } from './types/collections.js';
import type {
  ConnectionOrderBy,
  ConnectionPagingOptions,
  ConnectionQueryLiteral,
  ConnectionQueryOption,
} from './types/connections.js';
import type {
  DiscriminatorField,
  ModelKey,
  PlannedRow,
  RelationKeys,
  Row,
  WholeRelationRow,
} from './types/models.js';
import type { DefaultRelationNullable, IsToMany, RelatedModel } from './types/relations.js';
import type { ConnectionPageEntry, NodeSelection } from './types/selections.js';
import type { MapperCollection } from './utils/adapter.js';
import { assertConnectionCollection } from './utils/collection-state.js';
import { getPluginConfig } from './utils/config.js';
import {
  aggregateCount,
  CONNECTION_NODE_PATHS,
  type ConnectionPlan,
  connectionNodes,
  connectionNodeType,
  connectionSettings,
  pageSelection,
} from './utils/connections.js';
import { variantForRelationType } from './utils/contract.js';
import {
  applyCursorPagination,
  buildConnectionPage,
  type ConnectionPage,
  cursorColumns,
} from './utils/cursors.js';
import { InternalError } from './utils/errors.js';
import { applySelectionToCollection, planSelection } from './utils/map-query.js';
import { getIdentityFields, getModel } from './utils/model.js';
import { refFor } from './utils/refs.js';
import {
  CONNECTION_PAGE,
  COUNT_SLOT,
  EMPTY,
  NODE_SELECTION,
  type PlanPage,
  type PrismaNextSelection,
  relationArgs,
  slotsOfFieldParent,
  splitSelect,
  takeSlots,
} from './utils/selections.js';

type ConnectionArgs<Args extends InputFieldMap> = InputShapeFromFields<Args> &
  PothosSchemaTypes.DefaultConnectionArguments;

/** A `prismaObject` or `prismaInterface` ref whose type the connection's nodes use. */
export type HelperRef<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | PrismaNextObjectRef<Types, M, unknown>
  | PrismaNextInterfaceRef<Types, M, unknown>;

/**
 * What a helper's `select` loads with each row: columns, whole relations, and the to-one relation
 * that holds the nodes, as `nodeSelection()`.
 */
type ConnectionHelperSelect<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  readonly [K in (keyof Row<Types, M> & string) | RelationKeys<Types, M>]?: K extends RelationKeys<
    Types,
    M
  >
    ? true | (IsToMany<Types, M, K> extends true ? never : NodeSelection)
    : true;
};

interface UnknownHelperSelectKey<Key> {
  readonly 'Unknown key in select': Key;
}

/** Checks a helper's `select`, which is inferred from what the callback returns. */
type HelperSelectCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  readonly [K in keyof Select]: K extends keyof ConnectionHelperSelect<Types, M>
    ? ConnectionHelperSelect<Types, M>[K]
    : UnknownHelperSelectKey<K>;
};

type SelectedRelations<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Planned extends boolean,
> = {
  -readonly [K in keyof Select & RelationKeys<Types, M>]: Select[K] extends NodeSelection
    ?
        | (Planned extends true
            ? PlannedRow<Types, RelatedModel<Types, M, K>>
            : Row<Types, RelatedModel<Types, M, K>>)
        | (DefaultRelationNullable<Types, M, K> extends true ? null : never)
    : WholeRelation<Types, M, K>;
};

/** A relation a helper's `select` loads whole. */
type WholeRelation<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> =
  IsToMany<Types, M, K> extends true
    ? readonly WholeRelationRow<Types, RelatedModel<Types, M, K>>[]
    :
        | WholeRelationRow<Types, RelatedModel<Types, M, K>>
        | (DefaultRelationNullable<Types, M, K> extends true ? null : never);

/**
 * A row of a helper's page planned from a query: its key, the columns and relations its `select`
 * loads, and whatever the selection beneath the nodes needs. The rows `page` loads, and those
 * `applyPagination` loads when given `info`.
 */
export type ConnectionHelperRow<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select = {},
> = [keyof Select] extends [never]
  ? PlannedRow<Types, M>
  : PlannedRow<Types, M> &
      Pick<Row<Types, M>, keyof Select & keyof Row<Types, M>> &
      SelectedRelations<Types, M, Select, true>;

/** A row `applyPagination` loads without `info`: every column, and what `select` loads. */
type LoadedHelperRow<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  keyof Select,
] extends [never]
  ? Row<Types, M>
  : Row<Types, M> & SelectedRelations<Types, M, Select, false>;

/**
 * The row `resolveNode` gets. With a relation given `nodeSelection()`, it is planned. Otherwise the
 * selection beneath the nodes isn't planned into it, so it loads every column.
 */
type NodeSourceRow<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  {
    [K in keyof Select]: Select[K] extends NodeSelection ? K : never;
  }[keyof Select],
] extends [never]
  ? LoadedHelperRow<Types, M, Select>
  : ConnectionHelperRow<Types, M, Select>;

/**
 * A planned row of the helpers' page. The rows of helpers made with a discriminated model's
 * `prismaInterface` also hold the discriminator, which the interface's selection includes.
 */
type HelperRow<Types extends SchemaTypes, M extends ModelKey<Types>, Select, Ref> = [Ref] extends [
  PrismaNextInterfaceRef<Types, M, unknown>,
]
  ? ConnectionHelperRow<Types, M, Select> & Pick<Row<Types, M>, DiscriminatorField<Types, M>>
  : ConnectionHelperRow<Types, M, Select>;

/** A page's node: what `resolveNode` returns, or the row when it isn't given. */
type PageNode<Node, PageRow, MaybeRow extends boolean> = [Node] extends [never]
  ? PageRow
  : MaybeRow extends true
    ? Node | PageRow
    : Node;

/** What `applyPagination` returns: the paged collection, its count, and `wrap` for its rows. */
export interface PaginatedCollection<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  PageRow,
  Node,
> {
  collection: CollectionFor<Types, M, PageRow>;
  /** The count, run on first read. Undefined when `info` is given and doesn't select it. */
  totalCountPromise: Promise<number> | undefined;
  wrap(rows: readonly PageRow[], totalCount?: number): ConnectionPage<Node>;
}

export interface PrismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  MaybeRow extends boolean = false,
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
> {
  /** The ref passed in. For a model name, `Ref` isn't inferred, so this is its default ref. */
  ref: HelperRef<Types, M> extends Ref ? PrismaNextObjectRef<Types, M, Row<Types, M>> : Ref;
  getArgs(): Args;
  /** Adds the `totalCount` field to the options of a connection these helpers page. */
  connectionOptions<T extends object>(
    connectionOptions: T & {
      fields?: (
        t: PothosSchemaTypes.ObjectFieldBuilder<
          Types,
          { pageInfo: unknown; edges: unknown; totalCount?: number }
        >,
      ) => FieldMap;
    },
  ): T;
  /**
   * A field `select` entry for a to-many relation of this model. It loads one page of the relation
   * in the parent's query, with the selection beneath the connection's nodes, and its count when
   * `totalCount` is selected. Pass the rows to `resolve`.
   */
  page: ConnectionPageEntry<M, HelperRow<Types, M, Select, Ref>>;
  /**
   * The connection for the rows `page` loaded. `parent` is the parent the field's resolver was
   * given, not a copy of it: it holds the page's count and plan.
   */
  resolve(
    rows: readonly HelperRow<Types, M, Select, Ref>[],
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
    parent: object,
  ): ConnectionPage<PageNode<Node, HelperRow<Types, M, Select, Ref>, MaybeRow>>;
  /**
   * Pages a collection the resolver loads itself. With `info`, it selects what the nodes need.
   * Returns a promise when a `select` callback beneath the connection is async.
   */
  applyPagination(
    collection: ResolverCollection<Types, M>,
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
  ): MaybePromise<
    PaginatedCollection<
      Types,
      M,
      LoadedHelperRow<Types, M, Select>,
      PageNode<Node, LoadedHelperRow<Types, M, Select>, MaybeRow>
    >
  >;
  applyPagination(
    collection: ResolverCollection<Types, M>,
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
    info: GraphQLResolveInfo,
  ): MaybePromise<
    PaginatedCollection<
      Types,
      M,
      HelperRow<Types, M, Select, Ref>,
      PageNode<Node, HelperRow<Types, M, Select, Ref>, MaybeRow>
    >
  >;
}

export interface PrismaConnectionHelperOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  OrderBy extends ConnectionOrderBy<Types, M>,
  Args extends InputFieldMap,
  QueryLiteral = ConnectionQueryLiteral<Types, M>,
  Select = {},
> extends Pick<
    ConnectionPagingOptions<Types, unknown, M, Args, OrderBy>,
    'orderBy' | 'defaultSize' | 'maxSize'
  > {
  args?: Args | ((t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => Args);
  /** Counts the rows `query` keeps. Pass any other count to `wrap`. */
  totalCount?: TotalCountFlag<Types>;
  /** Filters the collection, like `t.relatedConnection`'s `query`. */
  query?: ConnectionQueryOption<Types, Args, QueryLiteral>;
  /**
   * What each row loads beside its key and cursor columns. A to-one relation given
   * `nodeSelection()` holds the nodes: the selection beneath them is planned into it.
   */
  select?: (
    nodeSelection: () => NodeSelection,
  ) => Select & NoInfer<HelperSelectCheck<Types, M, Select>>;
}

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  OrderBy extends ConnectionOrderBy<Types, M> = ConnectionOrderBy<Types, M>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M> = ConnectionQueryLiteral<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, OrderBy, Args, QueryLiteral, Select> & {
    resolveNode: (row: NodeSourceRow<Types, M, Select>) => Node;
  },
): PrismaConnectionHelpers<Types, M, Args, Select, Node, false, Ref>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  OrderBy extends ConnectionOrderBy<Types, M> = ConnectionOrderBy<Types, M>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M> = ConnectionQueryLiteral<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, OrderBy, Args, QueryLiteral, Select> & {
    resolveNode?: ((row: NodeSourceRow<Types, M, Select>) => Node) | undefined;
  },
): PrismaConnectionHelpers<Types, M, Args, Select, Node, true, Ref>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  OrderBy extends ConnectionOrderBy<Types, M>,
  Args extends InputFieldMap,
  Select,
  Node,
  Ref extends HelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, OrderBy, Args, QueryLiteral, Select> & {
    resolveNode?: ((row: NodeSourceRow<Types, M, Select>) => Node) | undefined;
  },
): object {
  const ref = refFor(builder, refOrModel);
  const modelKey = ref.modelKey as string;
  const config = getPluginConfig(builder);
  const model = getModel(config.contract, modelKey);
  const owner = `connection helpers for '${modelKey}'`;
  const settings = connectionSettings(config, modelKey, options);
  const { resolveNode } = options;

  // What `select` loads with each row beside its key and cursor columns.
  const nodeMarker: NodeSelection = { [NODE_SELECTION]: true };
  const selected = splitSelect(options.select?.(() => nodeMarker) ?? {}, model);
  const nodeRelation = selected.relations.find(([, value]) => value === nodeMarker)?.[0];
  // The nodes' planning starts from the relation's narrowing, so beneath a relation targeting a
  // variant model it leaves out what the variant model's own accessor can't load.
  const nodeSeed: PrismaNextSelection = nodeRelation
    ? {
        args: relationArgs(model.relations[nodeRelation]!, {
          loadIdentity: undefined,
          refine: undefined,
        }),
      }
    : EMPTY;
  const whole: Record<string, PrismaNextSelection> = {};
  for (const [name, value] of selected.relations) {
    if (value !== nodeMarker) {
      whole[name] = EMPTY;
    }
  }
  const ownColumns = [...selected.columns, ...getIdentityFields(config.contract, modelKey)];
  const withOwn = (seed: PrismaNextSelection): PrismaNextSelection => ({
    ...seed,
    columns: [...(seed.columns ?? []), ...ownColumns],
    relations: whole,
  });
  const withNodes = (own: PrismaNextSelection, nodes: PrismaNextSelection | undefined) => ({
    ...own,
    relations: { ...whole, [nodeRelation!]: nodes ?? EMPTY },
  });

  const toPage = (
    rows: readonly Record<string, unknown>[],
    planned: ConnectionPlan,
    args: PothosSchemaTypes.DefaultConnectionArguments,
    totalCount: number | undefined,
    parent: unknown,
  ) => {
    const page = buildConnectionPage(rows, planned, args, { totalCount, parent });
    // After building the page, so cursors are encoded from the rows.
    if (resolveNode) {
      for (const edge of page.edges) {
        (edge as { node: unknown }).node = resolveNode(edge.node as never);
      }
    }
    return page;
  };

  // Each selection of a field that loads `page`, as planned once for every parent row: the plan,
  // and the relation the page is of, whose slot holds its count.
  const pages = new WeakMap<Position, { planned: ConnectionPlan; name: string }>();
  const planPage: PlanPage = (relation, name, { scope, args, ctx, nested, selected, position }) => {
    const planned = settings.plan(args, ctx);
    pages.set(position, { planned, name });
    const nodeType = connectionNodeType(position.field.type);
    const { needsRows, count } = settings.selection(selected());
    // The rows load unless the count alone is selected, whose page then has none: the relation is
    // always an array. A field that isn't a connection, or selects only `__typename`, loads them.
    const loadsRows = needsRows || count !== 'aggregate';
    return pageSelection(relation, name, scope, {
      plan: planned,
      args,
      identity: { source: planPage, args, order: planned.order },
      variant: variantForRelationType(
        config.contract,
        owner,
        relation.targetModel,
        modelKey,
        InternalError,
      ),
      count: count === 'aggregate' ? { filtered: true } : undefined,
      // The nodes are planned into `nodeRelation`, or into the rows unless `resolveNode` makes them
      // something else. Rows whose nodes aren't planned load every column.
      rows: loadsRows
        ? (seed) => {
            const own = withOwn(seed);
            const include = nodeType === undefined ? undefined : connectionNodes(nodeType);
            if (nodeRelation) {
              return completeValue(include ? nested(nodeSeed, include) : nodeSeed, (nodes) =>
                withNodes(own, nodes),
              );
            }
            return resolveNode || !include ? { ...own, columns: null } : nested(own, include);
          }
        : undefined,
    });
  };

  const applyPagination = (
    collection: MapperCollection,
    args: PothosSchemaTypes.DefaultConnectionArguments,
    ctx: object,
    info: GraphQLResolveInfo | undefined,
  ) => {
    assertConnectionCollection(collection);
    const planned = settings.plan(args, ctx);
    const filtered = planned.where === undefined ? collection : collection.where(planned.where);
    const paged = applyCursorPagination(filtered, planned, args);

    const emit = (selection: PrismaNextSelection) =>
      config.adapter.emit(paged, selection, model, ctx);
    let rows: MaybePromise<MapperCollection>;
    if (!info) {
      rows = emit(nodeRelation ? withNodes(EMPTY, EMPTY) : { relations: whole });
    } else {
      const own = withOwn({ columns: cursorColumns(planned.order) });
      if (nodeRelation) {
        rows = completeValue(
          planSelection(info, config, ctx, { paths: CONNECTION_NODE_PATHS }, nodeSeed),
          (nodes) => emit(withNodes(own, nodes?.selection)),
        );
      } else if (resolveNode) {
        rows = emit({ ...own, columns: null });
      } else {
        rows = applySelectionToCollection(paged, model, info, config, ctx, {
          paths: CONNECTION_NODE_PATHS,
          seed: own,
        });
      }
    }

    // Counted before pagination but after `where`, so it matches the paged rows.
    let totalCountPromise: Promise<number> | undefined;
    const withCollection = (paginated: MapperCollection) => ({
      collection: paginated,
      get totalCountPromise() {
        if (settings.selectionFor(ctx, info).count === undefined) {
          return undefined;
        }
        if (!totalCountPromise) {
          totalCountPromise = aggregateCount(filtered);
          // Marks the rejection as handled. The consumer still receives it from the promise.
          totalCountPromise.catch(() => undefined);
        }
        return totalCountPromise;
      },
      wrap: (loaded: readonly Record<string, unknown>[], totalCount?: number) =>
        toPage(
          takeSlots(loaded, model, config.adapter.recordOf(paginated)),
          planned,
          args,
          totalCount,
          undefined,
        ),
    });
    return completeValue(rows, withCollection);
  };

  let args: Args | undefined;
  return {
    ref,
    getArgs: () =>
      (args ??=
        typeof options.args === 'function'
          ? builder.args(options.args)
          : (options.args ?? ({} as Args))),
    connectionOptions: settings.connectionOptions,
    page: { [CONNECTION_PAGE]: planPage },
    resolve(
      rows: readonly Record<string, unknown>[],
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: object,
      parent: object,
    ) {
      // The parent the field's resolver got holds the page's slots. Any other plans again, and has
      // no count.
      const slots = slotsOfFieldParent(parent);
      const page = slots?.position && pages.get(slots.position);
      const planned = page ? page.planned : settings.plan(args, ctx);
      const totalCount = page && (slots.value(page.name, COUNT_SLOT) as number | undefined);
      return toPage(rows, planned, args, totalCount, parent);
    },
    applyPagination: (
      collection: MapperCollection,
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: object,
      info?: GraphQLResolveInfo,
    ) => {
      // An invalid collection is reported as a rejected promise, like an invalid cursor.
      try {
        return applyPagination(collection, args, ctx, info);
      } catch (error) {
        return Promise.reject(error);
      }
    },
  };
}
