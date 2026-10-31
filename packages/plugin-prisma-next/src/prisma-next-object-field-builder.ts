import {
  completeValue,
  type FieldKind,
  type FieldRef,
  type InferredFieldOptionKeys,
  type InputFieldMap,
  type InterfaceParam,
  type MaybePromise,
  type NormalizeArgs,
  type ObjectRef,
  type PluginName,
  PothosSchemaError,
  PothosValidationError,
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import type { IndirectInclude } from '@pothos/selection-mapper';
import type { ContractRelation } from '@prisma/orm-framework/contract/types';
import type { GraphQLResolveInfo } from 'graphql';
import { PRISMA_NEXT_FIELD_SELECT, PRISMA_NEXT_LOADED } from './constants.js';
import type { ExposableColumn, ExposeColumnNullability } from './internal-types.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type {
  AnyContract,
  CursorSpec,
  HasAggregates,
  ModelName,
  PrismaNextRelatedConnectionOptions,
  PrismaNextRelationAggregateOptions,
  PrismaNextRelationCountOptions,
  PrismaNextRelationOptions,
  PrismaNextVariantFieldOptions,
  RelatedModel,
  RelationAggregateField,
  RelationAggregateOp,
  RelationAggregateResult,
  RelationFieldShape,
  RelationKeys,
  RelationNullable,
  RelationQuery,
  RelationTypeModel,
  Row,
  ShapeFromConnection,
  ToManyRelationKeys,
  VariantFieldShape,
} from './types.js';
import type { MapperCollection } from './utils/adapter.js';
import { getPluginConfig } from './utils/config.js';
import {
  CONNECTION_NODE_PATHS,
  connectionNeedsRows,
  connectionQuery,
  connectionSettings,
  createArgsCache,
  relatedCount,
  selectsRows,
} from './utils/connections.js';
import { assertContractModel, relationVariant } from './utils/contract.js';
import {
  applyCursorPagination,
  buildConnectionPage,
  buildPaginationParams,
  type CursorOrder,
  cursorColumns,
  validateCursor,
  validateCursorArgs,
} from './utils/cursors.js';
import { getModel, type PrismaNextRelation } from './utils/model.js';
import { getRefFromContractModel } from './utils/refs.js';
import {
  applyQuery,
  computedSelection,
  definedQuery,
  type PrismaNextSelectFn,
  relationArgs,
  rowsSelection,
  scopeOf,
  whereInput,
} from './utils/selections.js';

type ContextForAuth<Types extends SchemaTypes, Scopes extends {} = {}> =
  PothosSchemaTypes.ScopeAuthContextForAuth<Types, Scopes> extends {
    Context: infer T;
  }
    ? T extends object
      ? T
      : object
    : object;

type FieldAuthScopes<Types extends SchemaTypes, Parent, Args extends {} = {}> =
  PothosSchemaTypes.ScopeAuthFieldAuthScopes<Types, Parent, Args> extends {
    Scopes: infer T;
  }
    ? T
    : never;

function addAuthScopes(scopes: unknown, builder: object): object {
  const target = builder as { createField: (options: Record<string, unknown>) => unknown };
  const originalCreateField = target.createField;
  target.createField = function createField(options) {
    return originalCreateField.call(this, {
      authScopes: scopes,
      ...options,
    });
  };
  return builder;
}

function withAuthImpl<Types extends SchemaTypes, M extends ModelName<Types>>(
  this: PrismaNextObjectFieldBuilder<Types, M>,
  scopes: object,
): PrismaNextObjectFieldBuilder<Types, M> {
  const next = new PrismaNextObjectFieldBuilder<Types, M>(
    this.builder as PothosSchemaTypes.SchemaBuilder<Types>,
    this.modelName,
    this.contract,
    this.graphqlKind as 'Interface' | 'Object',
  );
  return addAuthScopes(scopes, next) as PrismaNextObjectFieldBuilder<Types, M>;
}

const RootBuilder: {
  new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
  ): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
} = RootFieldBuilder as never;

// The variance annotations spare each program a structural variance probe of the whole builder,
// which reaches into every model's row types. `Shape` is left unannotated, so its measured variance
// still allows the structural comparison that helpers typed with a wider shape rely on.
export class PrismaNextObjectFieldBuilder<
  in out Types extends SchemaTypes,
  in out M extends ModelName<Types>,
  Shape = unknown,
  in out ExposableShape = Row<Types, M>,
> extends RootBuilder<Types, Shape, 'PrismaNextObject'> {
  exposeBoolean = this.createExpose('Boolean');
  exposeFloat = this.createExpose('Float');
  exposeInt = this.createExpose('Int');
  exposeID = this.createExpose('ID');
  exposeString = this.createExpose('String');
  exposeBooleanList = this.createExpose(['Boolean']);
  exposeFloatList = this.createExpose(['Float']);
  exposeIntList = this.createExpose(['Int']);
  exposeIDList = this.createExpose(['ID']);
  exposeStringList = this.createExpose(['String']);

  withAuth: 'scopeAuth' extends PluginName
    ? <Scopes extends FieldAuthScopes<Types, Shape, Record<string, unknown>>>(
        scopes: Scopes,
      ) => PrismaNextObjectFieldBuilder<
        Omit<Types, 'Context'> & { Context: ContextForAuth<Types, Scopes> },
        M & ModelName<Omit<Types, 'Context'> & { Context: ContextForAuth<Types, Scopes> }>,
        Shape,
        ExposableShape
      >
    : '@pothos/plugin-scope-auth is required to use this method' = withAuthImpl as never;

  readonly modelName: M;
  readonly contract: Types['PrismaNextContract'];

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    modelName: M,
    contract: Types['PrismaNextContract'],
    graphqlKind: 'Interface' | 'Object' = 'Object',
  ) {
    super(builder, 'PrismaNextObject' as never, graphqlKind);
    this.modelName = modelName;
    this.contract = contract;
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    ResolveReturnShape,
    Name extends ExposableColumn<Types, ExposableShape, Type, Nullable>,
  >(
    // Positional so `Name extends ExposableColumn<…>` is inferred from the call site.
    name: Name,
    ...args: NormalizeArgs<
      [
        options: ExposeColumnNullability<Types, Type, ExposableShape, Name, Nullable> &
          Omit<
            PothosSchemaTypes.ObjectFieldOptions<
              Types,
              Shape,
              Type,
              Nullable,
              {},
              ResolveReturnShape
            >,
            'nullable' | 'select' | InferredFieldOptionKeys
          >,
      ]
    >
  ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'PrismaNextObject'> {
    const [options = {} as never] = args;
    return this.exposeField<Type, Nullable, never>(name as never, options) as FieldRef<
      Types,
      ShapeFromTypeParam<Types, Type, Nullable>,
      'PrismaNextObject'
    >;
  }

  private createExpose<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      ResolveReturnShape,
      Name extends ExposableColumn<
        Types,
        ExposableShape,
        Type,
        Type extends [unknown] ? { list: true; items: true } : true
      >,
    >(
      name: Name,
      ...args: NormalizeArgs<
        [
          options: ExposeColumnNullability<Types, Type, ExposableShape, Name, Nullable> &
            Omit<
              PothosSchemaTypes.ObjectFieldOptions<
                Types,
                Shape & Pick<ExposableShape, Name & keyof ExposableShape>,
                Type,
                Nullable,
                {},
                ResolveReturnShape
              >,
              'nullable' | 'select' | 'type' | InferredFieldOptionKeys
            >,
        ]
      >
    ): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'PrismaNextObject'> => {
      const [options = {} as never] = args;
      return this.expose(name as never, { ...options, type } as never) as never;
    };
  }

  variant<
    Variant extends PrismaNextObjectRef<Types, M, unknown> | M,
    Args extends InputFieldMap = {},
    Nullable extends boolean = false,
    IsNull extends MaybePromise<boolean> = never,
    Selected extends keyof Row<Types, M> & string = never,
  >(
    variant: Variant,
    ...allArgs: NormalizeArgs<
      [
        options: PrismaNextVariantFieldOptions<
          Types,
          M,
          Shape,
          Variant extends PrismaNextObjectRef<Types, M, unknown>
            ? Variant
            : PrismaNextObjectRef<Types, M>,
          Args,
          Nullable,
          IsNull,
          Selected
        >,
      ]
    >
  ): FieldRef<Types, VariantFieldShape<Types, M, Nullable, IsNull>, 'PrismaNextObject'> {
    const [options = {}] = allArgs as [Record<string, unknown>?];
    const ref =
      typeof variant === 'string'
        ? (getRefFromContractModel(variant as never, this.builder) as never)
        : variant;
    const variantTypeName = (ref as { name: string }).name;
    const {
      isNull,
      nullable,
      select: variantSelect,
      extensions: userExtensions,
      ...rest
    } = options as {
      isNull?: (
        parent: unknown,
        args: unknown,
        ctx: Types['Context'],
        info: GraphQLResolveInfo,
      ) => boolean | Promise<boolean>;
      nullable?: boolean;
      select?: readonly string[];
      extensions?: Record<string, unknown>;
    };
    if (isNull && nullable === false) {
      throw new PothosSchemaError(
        `t.variant on '${variantTypeName}': \`isNull\` can return null, but \`nullable: false\` was set. Either drop \`nullable: false\` or remove \`isNull\`.`,
      );
    }
    const forced = variantSelect ?? [];
    const select: PrismaNextSelectFn = (_args, _ctx, nested) =>
      completeValue(nested(true), (query) => ({
        ...query,
        columns: query.columns === null ? null : [...(query.columns ?? []), ...forced],
      }));
    const fieldOpts: Record<string, unknown> = {
      ...rest,
      type: ref,
      nullable: (nullable ?? !!isNull) as never,
      extensions: {
        ...userExtensions,
        pothosIndirectInclude: { getType: () => variantTypeName },
        [PRISMA_NEXT_FIELD_SELECT]: select,
      },
      resolve: isNull
        ? async (
            parent: unknown,
            args: unknown,
            ctx: Types['Context'],
            info: GraphQLResolveInfo,
          ) => {
            const result = await isNull(parent as never, args as never, ctx, info);
            return result ? null : parent;
          }
        : (parent: unknown) => parent as never,
    };
    return this.field(fieldOpts as never) as never;
  }

  relation<
    RelName extends RelationKeys<Types, M>,
    Query extends RelationQuery<Types, M, RelName, Args> | undefined,
    // The model behind `type`: a variant of the target narrows the load.
    TypeModel extends RelationTypeModel<Types, M, RelName> = RelatedModel<Types, M, RelName>,
    Nullable extends boolean = RelationNullable<Types, M, RelName, Query, TypeModel>,
    Args extends InputFieldMap = {},
    RelatedShape = Row<Types, RelatedModel<Types, M, RelName>>,
  >(
    name: RelName,
    options?: PrismaNextRelationOptions<
      Types,
      M,
      RelName,
      Nullable,
      Args,
      RelatedShape,
      Shape,
      Query,
      TypeModel
    >,
  ): FieldRef<Types, RelationFieldShape<Types, M, RelName, Nullable>, 'PrismaNextObject'> {
    const opts = (options ?? {}) as PrismaNextRelationOptions<
      Types,
      M,
      RelName,
      Nullable,
      Args,
      RelatedShape
    > & { extensions?: Record<string, unknown> };
    const relation = this.#relation(name as string);
    const targetRef =
      opts.type ?? (getRefFromContractModel(relation.targetModel as never, this.builder) as never);
    // Throws at build time for a type the relation can't return.
    const variant = relationVariant(
      this.contract as AnyContract,
      `t.relation('${name as string}') on '${this.modelName as string}'`,
      relation.targetModel,
      (targetRef as { modelName?: string }).modelName,
    );
    const {
      type: _type,
      query,
      nullable,
      extensions,
      ...rest
    } = opts as PrismaNextRelationOptions<Types, M, RelName, Nullable, Args, RelatedShape> & {
      query?: unknown;
      extensions?: Record<string, unknown>;
    };
    const relationName = name as string;
    const select: PrismaNextSelectFn = (args, ctx, nested, _selected, position) => {
      const spec = definedQuery(
        typeof query === 'function'
          ? (query as (args: object, ctx: object) => unknown)(args, ctx)
          : query,
      );
      // A callback builds a new query on every walk, so its definition and arguments identify it.
      const identity = spec && (typeof query === 'function' ? { source: query, args } : spec);
      return rowsSelection(
        relation,
        relationName,
        scopeOf(position),
        nested({
          columns: null,
          args: relationArgs(relation, identity, spec && ((rel) => applyQuery(rel, spec)), variant),
        }),
      );
    };
    return this.field({
      ...rest,
      type: relation.isToMany ? [targetRef] : targetRef,
      // A query or a variant type can filter a to-one relation's row out.
      nullable:
        nullable ??
        (relation.isToMany
          ? false
          : query !== undefined ||
            variant !== undefined ||
            isNullableToOne(this.#getRelationMeta(relationName))),
      extensions: {
        ...extensions,
        [PRISMA_NEXT_FIELD_SELECT]: select,
        [PRISMA_NEXT_LOADED]: (view: Record<string, unknown>) => view[relationName] !== undefined,
      },
      resolve: (parent: Record<string, unknown>) => parent[relationName],
    } as never) as never;
  }

  /** Exposes the row count of a to-many relation as an `Int`. */
  relationCount<
    // Targets without aggregates (MySQL) accept no relation.
    RelName extends HasAggregates<Types> extends true ? ToManyRelationKeys<Types, M> : never,
    Nullable extends boolean = false,
    Args extends InputFieldMap = {},
  >(
    name: RelName,
    options?: PrismaNextRelationCountOptions<Types, M, RelName, Nullable, Args, Shape>,
  ): FieldRef<Types, Nullable extends true ? number | null : number, 'PrismaNextObject'> {
    return this.#aggregateField(name as string, 'count', undefined, options ?? {}) as never;
  }

  /**
   * Exposes an aggregate of a to-many relation. Numeric results default to `Float` (`Int` for
   * count); other results need an explicit scalar. Reducers are nullable by default.
   */
  relationAggregate<
    RelName extends ToManyRelationKeys<Types, M>,
    Op extends RelationAggregateOp<Types>,
    Field extends
      | RelationAggregateField<Types, RelatedModel<Types, M, RelName>, Op>
      | undefined = undefined,
    Nullable extends boolean = Op extends 'count' | 'countBigInt' ? false : true,
    Args extends InputFieldMap = {},
  >(
    name: RelName,
    options: PrismaNextRelationAggregateOptions<
      Types,
      M,
      RelName,
      Op,
      Nullable,
      Args,
      Field,
      Shape
    >,
  ): FieldRef<
    Types,
    Nullable extends true
      ? RelationAggregateResult<Types, RelatedModel<Types, M, RelName>, Op, Field> | null
      : NonNullable<RelationAggregateResult<Types, RelatedModel<Types, M, RelName>, Op, Field>>,
    'PrismaNextObject'
  > {
    const { op, field, ...rest } = options as typeof options & {
      op: string;
      field?: string;
    };
    return this.#aggregateField(name as string, op, field, rest) as never;
  }

  #aggregateField(
    name: string,
    op: string,
    field: string | undefined,
    options: Record<string, unknown>,
  ): FieldRef<Types, unknown, 'PrismaNextObject'> {
    if (!this.#relation(name).isToMany) {
      throw new PothosSchemaError(
        `Aggregate '${op}' on '${this.modelName as string}.${name}' needs a to-many relation.`,
      );
    }
    const { where, nullable, extensions, ...rest } = options as {
      where?: unknown;
      nullable?: boolean;
      extensions?: Record<string, unknown>;
    } & Record<string, unknown>;
    const reduce = (rel: MapperCollection): unknown => {
      const reducer = (rel as unknown as Record<string, unknown>)[op];
      if (typeof reducer !== 'function') {
        throw new PothosValidationError(
          `Aggregate '${op}' is not available on this ORM collection.`,
        );
      }
      return field === undefined ? reducer.call(rel) : reducer.call(rel, field);
    };
    const select: PrismaNextSelectFn = (args, ctx, _nested, _selected, position) =>
      computedSelection(name, scopeOf(position), { op, field, where, args }, (sub) => ({
        value: reduce(where === undefined ? sub : sub.where(whereInput(where, args, ctx))),
      }));
    return this.field({
      ...rest,
      type: options.type ?? (op === 'count' ? 'Int' : 'Float'),
      // Counts are never null; other aggregates are null over no rows.
      nullable: nullable ?? (op !== 'count' && op !== 'countBigInt'),
      extensions: {
        ...extensions,
        [PRISMA_NEXT_FIELD_SELECT]: select,
        [PRISMA_NEXT_LOADED]: (view: object) => Object.hasOwn(view, 'value'),
      },
      resolve: (parent: { value?: unknown }) => parent.value,
    } as never) as FieldRef<Types, unknown, 'PrismaNextObject'>;
  }

  relatedConnection: 'relay' extends PluginName
    ? <
        RelName extends ToManyRelationKeys<Types, M>,
        // The relay plugin applies the builder's default, as for any connection field.
        Nullable extends boolean = Types['DefaultFieldNullability'],
        Args extends InputFieldMap = {},
        Cursor extends CursorSpec<Types, RelatedModel<Types, M, RelName>> = CursorSpec<
          Types,
          RelatedModel<Types, M, RelName>
        >,
        RelatedShape = unknown,
        ConnectionInterfaces extends InterfaceParam<Types>[] = [],
        EdgeInterfaces extends InterfaceParam<Types>[] = [],
      >(
        name: RelName,
        options: PrismaNextRelatedConnectionOptions<
          Types,
          M,
          RelName,
          Nullable,
          Args,
          Cursor,
          RelatedShape,
          Shape
        >,
        connectionOptions?:
          | PothosSchemaTypes.ConnectionObjectOptions<
              Types,
              PrismaNextObjectRef<Types, RelatedModel<Types, M, RelName>, RelatedShape>,
              false,
              false,
              unknown,
              ConnectionInterfaces
            >
          | ObjectRef<Types, unknown>,
        edgeOptions?:
          | PothosSchemaTypes.ConnectionEdgeObjectOptions<
              Types,
              PrismaNextObjectRef<Types, RelatedModel<Types, M, RelName>, RelatedShape>,
              false,
              unknown,
              EdgeInterfaces
            >
          | ObjectRef<Types, unknown>,
      ) => FieldRef<
        Types,
        ShapeFromConnection<
          PothosSchemaTypes.ConnectionShapeHelper<
            Types,
            Row<Types, RelatedModel<Types, M, RelName>>,
            Nullable
          >
        >,
        'PrismaNextObject'
      >
    : '@pothos/plugin-relay is required to use this method' = function relatedConnection(
    this: PrismaNextObjectFieldBuilder<SchemaTypes, ModelName<SchemaTypes>>,
    name: string,
    options: {
      cursor: string | readonly string[];
      type?: { modelName: string };
      defaultSize?: number | ((args: unknown, ctx: unknown) => number);
      maxSize?: number | ((args: unknown, ctx: unknown) => number);
      query?: unknown;
      totalCount?:
        | boolean
        | ((
            parent: unknown,
            args: unknown,
            ctx: unknown,
            info: GraphQLResolveInfo,
          ) => number | Promise<number>);
      extensions?: Record<string, unknown>;
      [key: string]: unknown;
    },
    connectionOptions: object = {},
    edgeOptions: object = {},
  ) {
    if (typeof (this as { connection?: unknown }).connection !== 'function') {
      throw new PothosSchemaError(
        't.relatedConnection requires @pothos/plugin-relay to be loaded.',
      );
    }
    const relation = this.#relation(name);
    if (!relation.isToMany) {
      throw new PothosSchemaError(
        `t.relatedConnection('${name}') is only valid on to-many relations; ` +
          `'${this.modelName as string}.${name}' is a to-one relation.`,
      );
    }
    const config = getPluginConfig(this.builder);
    const relatedKey = relation.targetModel;
    const cursorOrder = validateCursor(config.contract, relatedKey, options.cursor);
    const targetRef =
      options.type ?? getRefFromContractModel(relatedKey as never, this.builder as never);
    const variant = relationVariant(
      config.contract,
      `t.relatedConnection('${name}') on '${this.modelName as string}'`,
      relatedKey,
      (targetRef as { modelName?: string }).modelName,
    );
    const {
      cursor: _cursor,
      type: _type,
      defaultSize,
      maxSize,
      query,
      totalCount,
      extensions,
      ...rest
    } = options;
    const settings = connectionSettings(config, { defaultSize, maxSize, totalCount });
    const relatedTypeName = (targetRef as { name?: string }).name ?? relatedKey;
    const include: IndirectInclude = {
      getType: () => relatedTypeName,
      paths: CONNECTION_NODE_PATHS.map((path) => path.map((segment) => ({ name: segment }))),
    };
    const narrow = (rel: MapperCollection) => (variant === undefined ? rel : rel.variant(variant));
    const mayReorder =
      typeof query === 'function' || (query as { orderBy?: unknown } | undefined)?.orderBy;
    // Per request and set of arguments, which every parent row shares: whether the client's
    // input is valid, checked before planning so a bad cursor or page size fails only this field,
    // and the ordering a request's `orderBy` chose, which the resolver encodes cursors under and
    // checks the client's cursor against.
    const requests = createArgsCache<{ failure?: { error: unknown }; order?: CursorOrder }>();
    const request = (args: object, ctx: object) => {
      const known = requests.get(args, ctx);
      if (known) {
        return known;
      }
      try {
        validateCursorArgs(
          cursorOrder,
          args as PothosSchemaTypes.DefaultConnectionArguments,
          config.codecs(ctx, relatedKey),
          { checkOrdering: !mayReorder },
        );
        return requests.set(args, ctx, {});
      } catch (error) {
        return requests.set(args, ctx, { failure: { error } });
      }
    };
    const select: PrismaNextSelectFn = (args, ctx, nested, selectedFields, position) => {
      if (request(args, ctx).failure) {
        return {};
      }
      const { where, orderBy } = connectionQuery(query, args, ctx);
      const filter = (rel: MapperCollection) => (where === undefined ? rel : rel.where(where));
      const identity = { source: select, args };
      const selected = selectedFields();
      const count =
        totalCount === true && selected.has('totalCount')
          ? computedSelection(name, scopeOf(position), identity, (sub) => ({
              count: relatedCount(
                config.filterConnectionTotalCount ? filter(narrow(sub)) : narrow(sub),
              ),
            }))
          : {};
      if (!selectsRows(selected)) {
        return count;
      }
      const page = (rel: MapperCollection) => {
        const result = applyCursorPagination(
          filter(rel),
          cursorOrder,
          args as PothosSchemaTypes.DefaultConnectionArguments,
          {
            ...settings.sizes(args, ctx),
            codecs: config.codecs(ctx, relatedKey),
            orderBy,
            checkOrdering: !orderBy,
          },
        );
        if (orderBy) {
          request(args, ctx).order = result.cursor;
        }
        return result.collection;
      };
      const rows = nested(
        {
          columns: cursorColumns(cursorOrder),
          args: relationArgs(relation, identity, page, variant),
        },
        include,
      );
      return completeValue(rowsSelection(relation, name, scopeOf(position), rows), (planned) => ({
        ...planned,
        ...count,
      }));
    };

    const connectionConfig = {
      ...rest,
      type: targetRef,
      extensions: {
        ...extensions,
        pothosIndirectInclude: include,
        [PRISMA_NEXT_FIELD_SELECT]: select,
        [PRISMA_NEXT_LOADED]: (
          view: Record<string, unknown>,
          args: object,
          ctx: object,
          info: GraphQLResolveInfo,
        ) =>
          !!request(args, ctx).failure ||
          ((!connectionNeedsRows(ctx, info) || view[name] !== undefined) &&
            (settings.countSource(ctx, info) !== 'aggregate' || Object.hasOwn(view, 'count'))),
      },
      resolve: async (
        parent: Record<string, unknown>,
        args: PothosSchemaTypes.DefaultConnectionArguments,
        context: object,
        info: GraphQLResolveInfo,
      ) => {
        const { failure, order } = request(args, context);
        if (failure) {
          throw failure.error;
        }
        const codecs = config.codecs(context, relatedKey);
        if (order) {
          validateCursorArgs(order, args, codecs);
        }
        const rows = connectionNeedsRows(context, info) ? parent[name] : [];
        const pagination = buildPaginationParams(order ?? cursorOrder, args, {
          ...settings.sizes(args, context),
          codecs,
        });
        const countSource = settings.countSource(context, info);
        const totalCount =
          countSource === 'aggregate'
            ? (parent.count as number | undefined)
            : await countSource?.(parent, args, context, info);
        return buildConnectionPage(rows as Record<string, unknown>[], pagination, totalCount);
      },
    };
    return (
      this as typeof this & { connection: (cfg: object, c?: object, e?: object) => unknown }
    ).connection(connectionConfig, settings.connectionOptions(connectionOptions), edgeOptions);
  } as never;

  #relation(name: string): PrismaNextRelation {
    // A variant's planner model is its root's, which has every variant's relations; the contract
    // model rejects another variant's.
    this.#getRelationMeta(name);
    return getModel(this.contract as AnyContract, this.modelName as string).relations[name]!;
  }

  #getRelationMeta(relationName: string): ContractRelation {
    const model = assertContractModel(this.contract as AnyContract, this.modelName as string);
    const rel = model.relations[relationName];
    if (!rel) {
      throw new PothosSchemaError(
        `Relation '${relationName}' not found on model '${this.modelName as string}'. ` +
          `Available: ${Object.keys(model.relations).join(', ') || '(none)'}`,
      );
    }
    return rel;
  }
}

// An embed records no nullability; its row may be absent.
const isNullableToOne = (meta: ContractRelation) => ('nullable' in meta ? meta.nullable : true);
