import {
  completeValue,
  type InputFieldMap,
  type InputShapeFromFields,
  type SchemaTypes,
} from '@pothos/core';
import type { NestedSelection } from '@pothos/selection-mapper';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { TotalCountFlag } from './types/aggregates.js';
import type {
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
import { getPluginConfig } from './utils/config.js';
import { connectionPaging, pageOf } from './utils/connections.js';
import { variantForRelationType } from './utils/contract.js';
import { buildConnectionPage, type ConnectionPage } from './utils/cursors.js';
import { getIdentityFields, getModel } from './utils/model.js';
import { refFor } from './utils/refs.js';
import {
  CONNECTION_PAGE,
  EMPTY,
  NODE_SELECTION,
  type PlanPage,
  type PrismaNextSelection,
  relationArgs,
  splitSelect,
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

/**
 * Where the nodes sit beneath the connection field. The selection mapper finds the node type there,
 * through any wrapper such as plugin-errors' result union.
 */
const NODE_PATH = ['edges', 'node'];

/** The page `resolve` returns, with its count when the helpers count. */
type HelperPage<Node, Counted> = ConnectionPage<Node> &
  (Counted extends true ? { totalCount: number } : unknown);

export interface PrismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  MaybeRow extends boolean = false,
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
  Counted = false,
> {
  /** The ref passed in. For a model name, `Ref` isn't inferred, so this is its default ref. */
  ref: HelperRef<Types, M> extends Ref ? PrismaNextObjectRef<Types, M, Row<Types, M>> : Ref;
  getArgs(): Args;
  /**
   * The entry of a to-many relation of this model in a connection field's select function. It
   * loads one page of the relation in the parent's query, with the selection beneath the
   * connection's nodes, and its count when `totalCount` is selected. Pass the rows to `resolve`.
   */
  getQuery(
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
    nestedSelection: (...args: never[]) => unknown,
  ): ConnectionPageEntry<M, HelperRow<Types, M, Select, Ref>>;
  /** The connection for the rows `getQuery` loaded. */
  resolve(
    rows: readonly HelperRow<Types, M, Select, Ref>[],
    args: ConnectionArgs<Args>,
    ctx: Types['Context'],
  ): HelperPage<PageNode<Node, HelperRow<Types, M, Select, Ref>, MaybeRow>, Counted>;
}

export interface PrismaConnectionHelperOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap,
  QueryLiteral = ConnectionQueryLiteral<Types, M>,
  Select = {},
  Counted = boolean,
> extends Pick<ConnectionPagingOptions<Types, unknown, Args>, 'defaultSize' | 'maxSize'> {
  args?: Args | ((t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => Args);
  /** Counts the rows `query` keeps, when the connection selects `totalCount`. */
  totalCount?: Counted & TotalCountFlag<Types>;
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
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M> = ConnectionQueryLiteral<Types, M>,
  Counted extends boolean = false,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, Args, QueryLiteral, Select, Counted> & {
    resolveNode: (row: NodeSourceRow<Types, M, Select>) => Node;
  },
): PrismaConnectionHelpers<Types, M, Args, Select, Node, false, Ref, Counted>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap = {},
  Select = {},
  Node = never,
  Ref extends HelperRef<Types, M> = HelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M> = ConnectionQueryLiteral<Types, M>,
  Counted extends boolean = false,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, Args, QueryLiteral, Select, Counted> & {
    resolveNode?: ((row: NodeSourceRow<Types, M, Select>) => Node) | undefined;
  },
): PrismaConnectionHelpers<Types, M, Args, Select, Node, true, Ref, Counted>;

export function prismaConnectionHelpers<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap,
  Select,
  Node,
  Ref extends HelperRef<Types, M>,
  QueryLiteral extends ConnectionQueryLiteral<Types, M>,
  Counted extends boolean,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  refOrModel: M | (Ref & HelperRef<Types, M>),
  options: PrismaConnectionHelperOptions<Types, M, Args, QueryLiteral, Select, Counted> & {
    resolveNode?: ((row: NodeSourceRow<Types, M, Select>) => Node) | undefined;
  },
): object {
  const ref = refFor(builder, refOrModel);
  const modelKey = ref.modelKey as string;
  const config = getPluginConfig(builder);
  const model = getModel(config.contract, modelKey);
  const owner = `connection helpers for '${modelKey}'`;
  const paging = connectionPaging(config, modelKey, options);
  const { resolveNode } = options;
  const identityFields = getIdentityFields(config.contract, modelKey);
  const nodeMarker: NodeSelection = { [NODE_SELECTION]: true };

  /** The selection of each row of a page: what `select` loads, and the nodes. */
  const pageRows = (
    seed: PrismaNextSelection,
    nested: NestedSelection<PrismaNextSelection>,
    args: object,
    ctx: object,
  ) => {
    const selected = splitSelect(
      options.select?.(() => nodeMarker, args as never, ctx) ?? {},
      model,
    );
    const relations: Record<string, PrismaNextSelection> = {};
    let nodeRelation: string | undefined;
    for (const [name, value] of selected.relations) {
      if (value === nodeMarker) {
        nodeRelation = name;
      } else {
        relations[name] = EMPTY;
      }
    }
    const own: PrismaNextSelection = {
      ...seed,
      columns: [...(seed.columns ?? []), ...selected.columns, ...identityFields],
      relations,
    };
    if (nodeRelation) {
      // The nodes' planning starts from the relation's narrowing, so beneath a relation targeting
      // a variant model it leaves out what the variant model's own accessor can't load.
      const nodeSeed: PrismaNextSelection = {
        args: relationArgs(model.relations[nodeRelation]!, {
          loadIdentity: undefined,
          refine: undefined,
        }),
      };
      return completeValue(nested(nodeSeed, NODE_PATH), (nodes) => ({
        ...own,
        relations: { ...relations, [nodeRelation]: nodes },
      }));
    }
    // Rows that `resolveNode` makes into something else aren't the nodes, so they load whole.
    return resolveNode ? { ...own, columns: null } : nested(own, NODE_PATH);
  };

  const planPage =
    (args: object, ctx: object): PlanPage =>
    (relation, name, field) =>
      paging.planPage(relation, name, field, args, ctx, {
        identity: { source: planPage, args },
        variant: variantForRelationType(config.contract, owner, relation.targetModel, modelKey),
        filtered: true,
        rows: (seed) => pageRows(seed, field.nested, args, ctx),
      });

  let args: Args | undefined;
  return {
    ref,
    getArgs: () =>
      (args ??=
        typeof options.args === 'function'
          ? builder.args(options.args)
          : (options.args ?? ({} as Args))),
    getQuery: (args: object, ctx: object) => ({ [CONNECTION_PAGE]: planPage(args, ctx) }),
    resolve(
      rows: readonly Record<string, unknown>[],
      args: PothosSchemaTypes.DefaultConnectionArguments,
    ) {
      const { plan, count } = pageOf(rows);
      const page = buildConnectionPage(rows, plan, args, { totalCount: count });
      // After building the page, so cursors are encoded from the rows.
      if (resolveNode) {
        for (const edge of page.edges) {
          (edge as { node: unknown }).node = resolveNode(edge.node as never);
        }
      }
      return page;
    },
  };
}
