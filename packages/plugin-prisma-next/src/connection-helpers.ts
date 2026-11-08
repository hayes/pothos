import {
  completeValue,
  type InputFieldMap,
  type InputShapeFromFields,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import type { PathSegment, SelectedFieldNode } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type { PlannedRowBrand, PrismaNextObjectRef } from './object-ref.js';
import type { TotalCountFlag } from './types/aggregates.js';
import type { ResolverCollection, UnorderedCollection } from './types/collections.js';
import type {
  ConnectionPagingOptions,
  ConnectionQueryLiteral,
  ConnectionQueryOption,
} from './types/connections.js';
import type {
  DiscriminatorField,
  LoadedRow,
  ModelKey,
  PlannedRow,
  RelationKeys,
  Row,
  WholeRelationRow,
} from './types/models.js';
import type { DefaultRelationNullable, IsToMany, RelatedModel } from './types/relations.js';
import type { ConnectionPageEntry, NodeSelection } from './types/selections.js';
import type { MapperCollection } from './utils/adapter.js';
import {
  CONNECTION_PAGE,
  NODE_SELECTION,
  type PlanPage,
  type RelationEntry,
  relationArgs,
  splitSelect,
} from './utils/compile-select.js';
import { getPluginConfig } from './utils/config.js';
import { CONNECTION_NODE_PATHS, connectionPaging } from './utils/connections.js';
import { variantForRelationType } from './utils/contract.js';
import { buildConnectionPage, type ConnectionPage } from './utils/cursors.js';
import { type FieldLoads, fieldLoads, keyOf, type LoadRef, refOf } from './utils/loads.js';
import { initialSelection, nestedFromInfo } from './utils/map-query.js';
import { getModel } from './utils/model.js';
import { refFor } from './utils/refs.js';
import { PAGE, type PageData, parseRow, viewOf } from './utils/rows.js';
import { appliesCursors, EMPTY, type PrismaNextSelection } from './utils/selections.js';

type ConnectionArgs<Args extends InputFieldMap> = InputShapeFromFields<Args> &
  PothosSchemaTypes.DefaultConnectionArguments;

/** A `prismaObject` or `prismaInterface` ref whose type the connection's nodes use. */
export type ConnectionHelperRef<Types extends SchemaTypes, M extends ModelKey<Types>> =
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

/** Checks a helper's `select`, which is inferred from what the callback returns. */
type HelperSelectCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  readonly [K in keyof Select]: K extends keyof ConnectionHelperSelect<Types, M>
    ? ConnectionHelperSelect<Types, M>[K]
    : never;
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
            : LoadedRow<Types, RelatedModel<Types, M, K>>)
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
    ? readonly (WholeRelationRow<Types, RelatedModel<Types, M, K>> &
        PlannedRowBrand<RelatedModel<Types, M, K>>)[]
    :
        | (WholeRelationRow<Types, RelatedModel<Types, M, K>> &
            PlannedRowBrand<RelatedModel<Types, M, K>>)
        | (DefaultRelationNullable<Types, M, K> extends true ? null : never);

/**
 * A row of a helper's page: its key, the columns and relations its `select` loads, and whatever the
 * selection beneath the nodes needs.
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

/** A row whose nodes aren't planned into it: every column, and what `select` loads. */
type LoadedHelperRow<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  keyof Select,
] extends [never]
  ? LoadedRow<Types, M>
  : LoadedRow<Types, M> & SelectedRelations<Types, M, Select, false>;

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

/**
 * The connection `resolve` returns. Its nodes are what `resolveNode` returns, or the rows when it
 * isn't given. With `resolveNode`, each edge also holds its row's keys, for edge fields to read.
 */
type HelperPage<Node, PageRow, MaybeRow extends boolean> = [Node] extends [never]
  ? ConnectionPage<PageRow>
  : MaybeRow extends true
    ? ConnectionPage<Node | PageRow>
    : Omit<ConnectionPage<Node>, 'edges'> & {
        edges: (Omit<PageRow, 'node' | 'cursor'> & { node: Node; cursor: string })[];
      };

/**
 * The names selected on a connection at `prefix` beneath its field. Only `totalCount` is looked up
 * there, so the page always loads rows.
 */
function selectedBeneath(selected: SelectedFieldNode, prefix: string[]) {
  const names = new Set(['edges']);
  if (selected([...prefix, 'totalCount'])) {
    names.add('totalCount');
  }
  return () => names;
}

export interface PrismaNextConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  MaybeRow extends boolean = false,
  Ref extends ConnectionHelperRef<Types, M> = ConnectionHelperRef<Types, M>,
> {
  /** The ref passed in. For a model name, `Ref` isn't inferred, so this is its default ref. */
  ref: ConnectionHelperRef<Types, M> extends Ref
    ? PrismaNextObjectRef<Types, M, Row<Types, M>>
    : Ref;
  getArgs(): Args;
  /**
   * The entry of a to-many relation of this model in a connection field's select function. It
   * loads one page of the relation in the parent's query, with the selection beneath the
   * connection's nodes, and its count when `totalCount` is selected. Pass the rows to `resolve`.
   * `args` are the field's. For a connection beneath the field, at a prefixed path, they're
   * ignored: it pages by the connection field's own arguments, and fails the request when aliases
   * of that connection select different ones.
   */
  getQuery(
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
    nestedSelection: (options: { path: readonly PathSegment[] }) => unknown,
  ): ConnectionPageEntry<M, HelperRow<Types, M, Select, Ref>>;
  /**
   * Loads one page of `collection`, a collection of this model, for the root connection field
   * `info` resolves: filtered and paged as `getQuery` pages a relation, with the selection beneath
   * the connection's nodes, and its count when `totalCount` is selected. Pass the rows to `resolve`.
   */
  load<C extends ResolverCollection<Types, M>>(
    collection: C & NoInfer<UnorderedCollection<C>>,
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
    info: GraphQLResolveInfo,
  ): Promise<HelperRow<Types, M, Select, Ref>[]>;
  /**
   * The connection of `rows`, paged by `args` as `getQuery` pages them. `totalCount` is the count
   * `getQuery` or `load` loaded with the rows, unless one is passed. `parent` is passed on to the
   * connection.
   */
  resolve(
    rows: readonly HelperRow<Types, M, Select, Ref>[],
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
    options?: ConnectionHelperResolveOptions,
  ): HelperPage<Node, HelperRow<Types, M, Select, Ref>, MaybeRow>;
}

/** What a connection helper's `resolve` passes on to the connection. */
export interface ConnectionHelperResolveOptions {
  /** The connection field's parent. */
  parent?: unknown;
  /** The connection's count, in place of one `getQuery` or `load` loaded. */
  totalCount?: number;
}

export interface PrismaNextConnectionHelperOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap,
  QueryLiteral = ConnectionQueryLiteral<Types, M>,
  Select = {},
> extends Pick<ConnectionPagingOptions<Types, unknown, Args>, 'defaultSize' | 'maxSize'> {
  args?: Args | ((t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => Args);
  /** Counts the rows `query` keeps, when the connection selects `totalCount`. */
  totalCount?: TotalCountFlag<Types>;
  /** Filters and orders the relation, like `t.relatedConnection`'s `query`. */
  query?: ConnectionQueryOption<Types, M, Args, QueryLiteral>;
  /**
   * What each row loads beside its key and cursor columns. A to-one relation given
   * `nodeSelection()` holds the nodes: the selection beneath them is planned into it.
   */
  select?: (
    nodeSelection: () => NodeSelection,
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
  ) => Select & NoInfer<HelperSelectCheck<Types, M, Select>>;
}

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  Ref extends ConnectionHelperRef<Types, M> = ConnectionHelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M> = ConnectionQueryLiteral<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & ConnectionHelperRef<Types, M>),
  options: PrismaNextConnectionHelperOptions<Types, M, Args, QueryLiteral, Select> & {
    resolveNode: (row: NodeSourceRow<Types, M, Select>) => Node;
  },
): PrismaNextConnectionHelpers<Types, M, Args, Select, Node, false, Ref>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  Ref extends ConnectionHelperRef<Types, M> = ConnectionHelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M> = ConnectionQueryLiteral<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & ConnectionHelperRef<Types, M>),
  options: PrismaNextConnectionHelperOptions<Types, M, Args, QueryLiteral, Select> & {
    resolveNode?: ((row: NodeSourceRow<Types, M, Select>) => Node) | undefined;
  },
): PrismaNextConnectionHelpers<Types, M, Args, Select, Node, true, Ref>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap,
  Select,
  Node,
  Ref extends ConnectionHelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & ConnectionHelperRef<Types, M>),
  options: PrismaNextConnectionHelperOptions<Types, M, Args, QueryLiteral, Select> & {
    resolveNode?: ((row: NodeSourceRow<Types, M, Select>) => Node) | undefined;
  },
): object {
  const ref = refFor(builder, refOrModel);
  const modelKey = ref.modelKey as string;
  const config = getPluginConfig(builder);
  const model = getModel(config.contract, modelKey);
  const subject = `connection helpers for '${modelKey}'`;
  const paging = connectionPaging(config, modelKey, options);
  const { resolveNode } = options;
  const nodeMarker: NodeSelection = { [NODE_SELECTION]: true };

  /**
   * The selection of each row of a page: what `select` loads, and the nodes, whose selection
   * `nodes` plans from a seed. A relation `select` loads whole but not by its name is read through
   * a view of each row.
   */
  const pageRows = (
    seed: PrismaNextSelection,
    nodes: (seed: PrismaNextSelection) => MaybePromise<PrismaNextSelection>,
    args: object,
    ctx: object,
  ): MaybePromise<{ selection: PrismaNextSelection; beneath?: FieldLoads }> => {
    const selected = splitSelect(
      options.select?.(() => nodeMarker, args as never, ctx) ?? {},
      model,
    );
    const relations: Record<string, PrismaNextSelection> = {};
    const refs: LoadRef[] = [];
    let nodeRelation: string | undefined;
    for (const [name, entry] of selected.relations) {
      if (entry === nodeMarker) {
        nodeRelation = name;
      } else {
        const ref = refOf(config, ctx, model, { kind: 'rows', relation: name });
        relations[keyOf(ref)] = EMPTY;
        refs.push(ref);
      }
    }
    const beneath = refs.length ? fieldLoads(model, refs) : undefined;
    const own: PrismaNextSelection = {
      ...seed,
      columns: [...(seed.columns ?? []), ...selected.columns, ...model.identity],
      relations,
    };
    if (nodeRelation) {
      // The nodes' planning starts from the relation's narrowing, so beneath a relation targeting
      // a variant model it leaves out what the variant model's own accessor can't load.
      const nodeSeed: PrismaNextSelection = { args: relationArgs(model.relations[nodeRelation]!) };
      return completeValue(nodes(nodeSeed), (planned) => ({
        selection: { ...own, relations: { ...relations, [nodeRelation]: planned } },
        beneath,
      }));
    }
    // Rows that `resolveNode` makes into something else aren't the nodes, so they load whole.
    return completeValue(resolveNode ? { ...own, columns: null } : nodes(own), (selection) => ({
      selection,
      beneath,
    }));
  };

  /**
   * Plans a page for `getQuery`. `paths` are where the connection's nodes sit beneath the field,
   * each of `CONNECTION_NODE_PATHS` as the field's `nestedSelection` prefixed it.
   */
  const planPage =
    (fieldArgs: object, ctx: object, paths: readonly PathSegment[][]): PlanPage =>
    (owner, relation, name, field) => {
      // The names of the path before `edges`, where the connection sits beneath the field. The
      // connection pages by its own arguments, not those of the field it sits beneath.
      const prefix = paths[0]!
        .slice(0, -CONNECTION_NODE_PATHS[0]!.length)
        .map((segment) => (typeof segment === 'string' ? segment : segment.name));
      // A path the connection doesn't select may not be in the schema, as `nodes` without
      // relay's `nodesOnConnection`.
      const selectedPaths = paths.filter(
        (_path, i) => i === 0 || field.selected([...prefix, ...CONNECTION_NODE_PATHS[i]!]),
      );
      const nodes = (seed: PrismaNextSelection) =>
        selectedPaths.reduce<MaybePromise<PrismaNextSelection>>(
          (planned, path) => completeValue(planned, (selection) => field.nested(selection, path)),
          seed,
        );
      const connectionArgs = prefix.length ? field.selected.args(prefix) : fieldArgs;
      if (!connectionArgs) {
        return { selection: EMPTY };
      }
      return completeValue(connectionArgs, (args) =>
        completeValue(
          paging.planPage(
            ctx,
            owner,
            relation,
            name,
            prefix.length ? selectedBeneath(field.selected, prefix) : field.selected,
            args,
            {
              variant: variantForRelationType(
                config.contract,
                subject,
                relation.targetModel,
                modelKey,
              ),
              filtered: true,
              rows: (seed) => pageRows(seed, nodes, args, ctx),
            },
          ),
          ({ selection, rows, count }) => ({
            selection,
            ref: count ? { ...rows, count } : rows,
          }),
        ),
      );
    };

  let builtArgs: Args | undefined;
  return {
    ref,
    getArgs: () =>
      (builtArgs ??=
        typeof options.args === 'function'
          ? builder.args(options.args)
          : (options.args ?? ({} as Args))),
    getQuery: (
      args: object,
      ctx: object,
      nestedSelection: (options: { path: readonly PathSegment[] }) => unknown,
    ) => {
      // The field's `nestedSelection` may prefix each path, for a connection beneath the field.
      const paths = CONNECTION_NODE_PATHS.map((path) => {
        const nested = (nestedSelection({ path }) as RelationEntry).path;
        return nested ? [...nested] : path;
      });
      return { [CONNECTION_PAGE]: planPage(args, ctx, paths) };
    },
    async load(
      collection: MapperCollection,
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: object,
      info: GraphQLResolveInfo,
    ) {
      let loads: FieldLoads | undefined;
      const { rows, totalCount } = await paging.loadPage(
        collection,
        undefined,
        args,
        ctx,
        info,
        (paged, seed) =>
          completeValue(
            pageRows(
              initialSelection(config.contract, modelKey, seed),
              nestedFromInfo(info, config, ctx, CONNECTION_NODE_PATHS),
              args,
              ctx,
            ),
            ({ selection, beneath }) => {
              loads = beneath;
              return {
                query: config.adapter.emit(paged, selection, model),
                cursors: appliesCursors(selection),
              };
            },
          ),
      );
      // `resolve` pages the rows from (args, ctx), so they only carry the count.
      return Object.assign(
        loads?.view ? rows.map((row) => viewOf(parseRow(row, model), loads!)) : rows,
        { [PAGE]: { count: totalCount } satisfies PageData },
      );
    },
    resolve(
      rows: readonly Record<string, unknown>[],
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: object,
      { parent, totalCount }: ConnectionHelperResolveOptions = {},
    ) {
      // Only the list `getQuery` or `load` loaded carries its count.
      const page = buildConnectionPage(rows, paging.pagingPlan(args, ctx), args, {
        totalCount: totalCount ?? (rows as { [PAGE]?: PageData })[PAGE]?.count,
        parent,
      });
      if (!resolveNode) {
        return page;
      }
      // Each edge keeps its cursor, which is encoded from the row.
      const edges = page.edges.map((edge) =>
        Object.defineProperty(
          { ...edge.node, node: resolveNode(edge.node as never) },
          'cursor',
          Object.getOwnPropertyDescriptor(edge, 'cursor')!,
        ),
      );
      return { ...page, edges };
    },
  };
}
