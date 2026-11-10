import {
  completeValue,
  type InputFieldMap,
  type InputShapeFromFields,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import type { PathSegment } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaInterfaceRef } from './interface-ref.js';
import type { PlannedRowBrand, PrismaObjectRef } from './object-ref.js';
import type { TotalCountFlag } from './types/aggregates.js';
import type { ResolverCollection, UnorderedCollection } from './types/collections.js';
import type {
  ConnectionPagingOptions,
  ConnectionQueryLiteral,
  ConnectionQueryOption,
} from './types/connections.js';
import type {
  DiscriminatorField,
  IsUnion,
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
import type { ConnectionPage } from './utils/cursors.js';
import { type FieldLoads, fieldLoads, keyOf, refOf } from './utils/loads.js';
import { nestedFromInfo } from './utils/map-query.js';
import { getModel } from './utils/model.js';
import { refFor } from './utils/refs.js';
import { PAGE, type PageData } from './utils/rows.js';
import { EMPTY, type PrismaSelection } from './utils/selections.js';

type ConnectionArgs<Args extends InputFieldMap> = InputShapeFromFields<Args> &
  PothosSchemaTypes.DefaultConnectionArguments;

/** A `prismaObject` or `prismaInterface` ref whose type the connection's nodes use. */
export type ConnectionHelperRef<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | PrismaObjectRef<Types, M, unknown>
  | PrismaInterfaceRef<Types, M, unknown>;

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

/** A possible marker is enough: that relation may contain only the planned node columns. */
type NodeRelation<Select> = Select extends unknown
  ? {
      [K in keyof Select]-?: [Extract<NonNullable<Select[K]>, NodeSelection>] extends [never]
        ? never
        : K;
    }[keyof Select]
  : never;

type HelperSelectCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  readonly [K in keyof Select]: K extends keyof ConnectionHelperSelect<Types, M>
    ? ConnectionHelperSelect<Types, M>[K]
    : never;
} & ([NodeRelation<Select>] extends [never]
  ? unknown
  : IsUnion<NodeRelation<Select>> extends true
    ? 'Select only one relation with nodeSelection()'
    : unknown);

type SelectedRelations<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Planned extends boolean,
> = {
  -readonly [K in keyof Select as K extends RelationKeys<Types, M>
    ? K
    : never]: K extends RelationKeys<Types, M>
    ?
        | (undefined extends Select[K] ? undefined : never)
        | (K extends NodeRelation<Select>
            ?
                | (Planned extends true
                    ? PlannedRow<Types, RelatedModel<Types, M, K>>
                    : LoadedRow<Types, RelatedModel<Types, M, K>>)
                | (DefaultRelationNullable<Types, M, K> extends true ? null : never)
            : WholeRelation<Types, M, K>)
    : never;
};

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
  : PlannedRow<Types, M> & {
      -readonly [K in keyof Select as K extends keyof Row<Types, M>
        ? K
        : never]: K extends keyof Row<Types, M>
        ? Row<Types, M>[K] | (undefined extends Select[K] ? undefined : never)
        : never;
    } & SelectedRelations<Types, M, Select, true>;

type LoadedHelperRow<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  keyof Select,
] extends [never]
  ? LoadedRow<Types, M>
  : LoadedRow<Types, M> & SelectedRelations<Types, M, Select, false>;

/** Planned with a `nodeSelection()` relation; otherwise it loads every column. */
type NodeSourceRow<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  NodeRelation<Select>,
] extends [never]
  ? LoadedHelperRow<Types, M, Select>
  : ConnectionHelperRow<Types, M, Select>;

/** Rows of helpers for a discriminated `prismaInterface` also hold the discriminator. */
type HelperRow<Types extends SchemaTypes, M extends ModelKey<Types>, Select, Ref> = [Ref] extends [
  PrismaInterfaceRef<Types, M, unknown>,
]
  ? ConnectionHelperRow<Types, M, Select> & Pick<Row<Types, M>, DiscriminatorField<Types, M>>
  : ConnectionHelperRow<Types, M, Select>;

/** With `resolveNode`, each edge also holds its row's keys, for edge fields to read. */
type HelperPage<Node, PageRow, MaybeRow extends boolean> = [Node] extends [never]
  ? ConnectionPage<PageRow>
  : MaybeRow extends true
    ? ConnectionPage<Node | PageRow>
    : Omit<ConnectionPage<Node>, 'edges'> & {
        edges: (Omit<PageRow, 'node' | 'cursor'> & { node: Node; cursor: string })[];
      };

export interface PrismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  MaybeRow extends boolean = false,
  Ref extends ConnectionHelperRef<Types, M> = ConnectionHelperRef<Types, M>,
> {
  /** The ref passed in. For a model name, `Ref` isn't inferred, so this is its default ref. */
  ref: ConnectionHelperRef<Types, M> extends Ref ? PrismaObjectRef<Types, M> : Ref;
  getArgs(): Args;
  /**
   * The entry of a to-many relation of this model in a connection field's select function. It
   * loads one page of the relation in the parent's query, with the selection beneath the
   * connection's nodes, and its count when `totalCount` is selected. Pass the rows to `resolve`.
   * `args` are the field's. A connection beneath the field, at a prefixed path, ignores them: it
   * pages by its own arguments, and fails the request when aliases of it select different ones.
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
   * Rejects existing ordering, includes, pagination or distinct settings before SQL.
   */
  load<C extends ResolverCollection<Types, M>>(
    collection: C & NoInfer<UnorderedCollection<C>>,
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
    info: GraphQLResolveInfo,
  ): Promise<HelperRow<Types, M, Select, Ref>[]>;
  /**
   * The connection of `rows`, paged by `args` as `getQuery` or `load` paged them. `totalCount` is
   * the count they loaded with the rows, unless one is passed.
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

export interface PrismaConnectionHelperOptions<
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
  options: PrismaConnectionHelperOptions<Types, M, Args, QueryLiteral, Select> & {
    resolveNode: (row: NodeSourceRow<Types, M, Select>) => Node;
  },
): PrismaConnectionHelpers<Types, M, Args, Select, Node, false, Ref>;

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
  options: PrismaConnectionHelperOptions<Types, M, Args, QueryLiteral, Select> & {
    resolveNode?: ((row: NodeSourceRow<Types, M, Select>) => Node) | undefined;
  },
): PrismaConnectionHelpers<Types, M, Args, Select, Node, true, Ref>;

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
  options: PrismaConnectionHelperOptions<Types, M, Args, QueryLiteral, Select> & {
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

  const pageRows = (
    seed: PrismaSelection,
    nodes: (seed: PrismaSelection) => MaybePromise<PrismaSelection>,
    args: object,
    ctx: object,
  ): MaybePromise<{ selection: PrismaSelection; beneath?: FieldLoads }> => {
    const selected = splitSelect(
      options.select?.(() => nodeMarker, args as never, ctx) ?? {},
      model,
    );
    const nodeRelation = selected.relations.find(
      ({ entry }) => entry[NODE_SELECTION] === true,
    )?.name;
    const refs = selected.relations
      .filter(({ entry }) => entry[NODE_SELECTION] !== true)
      .map(({ name }) => refOf(config, ctx, model, { kind: 'rows', relation: name }));
    const relations = Object.fromEntries(refs.map((ref) => [keyOf(ref), EMPTY]));
    const beneath = refs.length ? fieldLoads(model, refs) : undefined;
    const own: PrismaSelection = {
      ...seed,
      columns: [...(seed.columns ?? []), ...selected.columns, ...model.identity],
      relations,
    };
    if (nodeRelation) {
      // Seeded with the relation's narrowing, so it leaves out what a variant model can't load.
      const nodeSeed: PrismaSelection = { args: relationArgs(model.relations[nodeRelation]!) };
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

  /** `paths` are `CONNECTION_NODE_PATHS` as the field's `nestedSelection` prefixed them. */
  const planPage =
    (fieldArgs: object, ctx: object, paths: readonly PathSegment[][]): PlanPage =>
    (owner, relation, name, field) => {
      // Where the connection sits beneath the field; it pages by its own arguments there.
      const prefix = paths[0]!
        .slice(0, -CONNECTION_NODE_PATHS[0]!.length)
        .map((segment) => (typeof segment === 'string' ? segment : segment.name));
      // An unselected path may not be in the schema (`nodes` without `nodesOnConnection`).
      const selectedPaths = paths.filter(
        (_path, i) => i === 0 || field.selected([...prefix, ...CONNECTION_NODE_PATHS[i]!]),
      );
      const nodes = (seed: PrismaSelection) =>
        selectedPaths.reduce<MaybePromise<PrismaSelection>>(
          (planned, path) => completeValue(planned, (selection) => field.nested(selection, path)),
          seed,
        );
      const connectionArgs = prefix.length ? field.selected.args(prefix) : fieldArgs;
      // Beneath the field, only `totalCount` is looked up, so the page always loads rows.
      const names = prefix.length
        ? new Set(field.selected([...prefix, 'totalCount']) ? ['edges', 'totalCount'] : ['edges'])
        : field.selected();
      if (!connectionArgs) {
        return { selection: EMPTY };
      }
      const variant = variantForRelationType(
        config.contract,
        subject,
        relation.targetModel,
        modelKey,
      );
      return completeValue(connectionArgs, (args) =>
        paging.pageLoads(ctx, owner, relation, name, args, names, {
          variant,
          filtered: true,
          rows: (seed) => pageRows(seed, nodes, args, ctx),
        }),
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
      const nodes = nestedFromInfo(info, config, ctx, CONNECTION_NODE_PATHS);
      const { rows, totalCount } = await paging.rootPage(
        collection,
        undefined,
        args,
        ctx,
        info,
        (seed) => pageRows(seed, nodes, args, ctx),
      );
      // `resolve` pages the rows from (args, ctx), so they only carry the count.
      return Object.assign(rows, { [PAGE]: { count: totalCount } satisfies PageData });
    },
    resolve(
      rows: readonly Record<string, unknown>[],
      args: PothosSchemaTypes.DefaultConnectionArguments,
      ctx: object,
      options: ConnectionHelperResolveOptions = {},
    ) {
      const page = paging.page(rows, args, ctx, options);
      if (!resolveNode) {
        return page;
      }
      // Keep the cursor getter, which encodes from the row.
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
