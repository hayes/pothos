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
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import type { Position } from '@pothos/selection-mapper';
import { type GraphQLResolveInfo, getNamedType } from 'graphql';
import { PRISMA_NEXT_FIELD_SELECTION, PRISMA_NEXT_MODEL } from './constants.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type {
  HasAggregates,
  PrismaNextRelationCountOptions,
  RelationCountWhereParam,
} from './types/aggregates.js';
import type {
  ConnectionQueryLiteral,
  ConnectionResultShape,
  PrismaNextRelatedConnectionOptions,
  ShapeFromConnection,
} from './types/connections.js';
import type {
  ExposableColumn,
  ExposeColumnNullability,
  PrismaNextVariantFieldOptions,
  VariantFieldShape,
} from './types/fields.js';
import type { AnyContract, ModelKey, RelationKeys, Row } from './types/models.js';
import type {
  RelatedModel,
  RelationFieldArgs,
  RelationFieldShape,
  RelationQuery,
  RelationTypeModel,
  ToManyRelationKeys,
} from './types/relations.js';
import type { MapperCollection } from './utils/adapter.js';
import { getPluginConfig } from './utils/config.js';
import {
  type ConnectionPlan,
  type ConnectionSettingsOptions,
  connectionNodes,
  connectionSettings,
  countOf,
  pageSelection,
} from './utils/connections.js';
import { modelDiscriminator, variantForRelationType } from './utils/contract.js';
import { buildConnectionPage, orderableProblem } from './utils/cursors.js';
import { reloadFor } from './utils/errors.js';
import { getModel, type PrismaNextRelation, sharedVariantRelationError } from './utils/model.js';
import { getRefFromContractModel, refFor } from './utils/refs.js';
import {
  COUNT_SLOT,
  completeOption,
  computedSelection,
  consumerId,
  copyIds,
  definedQuery,
  fieldBranch,
  fieldCopy,
  fieldValue,
  type PrismaNextSelectFn,
  queryRefinement,
  type RawSelect,
  relationArgs,
  rowOf,
  rowsSelection,
  splitSelect,
  VALUE_SLOT,
} from './utils/selections.js';
import { completeVariantRows } from './utils/variant-rows.js';

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

function withAuthImpl<Types extends SchemaTypes, M extends ModelKey<Types>>(
  this: PrismaNextObjectFieldBuilder<Types, M>,
  scopes: object,
): PrismaNextObjectFieldBuilder<Types, M> {
  const next = new PrismaNextObjectFieldBuilder<Types, M>(
    this.builder as PothosSchemaTypes.SchemaBuilder<Types>,
    this.modelKey,
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

// The variance annotations stop TypeScript from measuring the builder's variance structurally,
// which would walk every model's row types. `Shape` is left unannotated because helpers typed with
// a wider shape rely on its measured variance.
export class PrismaNextObjectFieldBuilder<
  in out Types extends SchemaTypes,
  in out M extends ModelKey<Types>,
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
        M & ModelKey<Omit<Types, 'Context'> & { Context: ContextForAuth<Types, Scopes> }>,
        Shape,
        ExposableShape
      >
    : '@pothos/plugin-scope-auth is required to use this method' = withAuthImpl as never;

  readonly modelKey: M;
  readonly contract: Types['PrismaNextContract'];

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    modelKey: M,
    contract: Types['PrismaNextContract'],
    graphqlKind: 'Interface' | 'Object' = 'Object',
  ) {
    super(builder, 'PrismaNextObject' as never, graphqlKind);
    this.modelKey = modelKey;
    this.contract = contract;
  }

  expose<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    ResolveReturnShape,
    Name extends ExposableColumn<Types, ExposableShape, Type, Nullable>,
  >(
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
    Nullable extends boolean = Types['DefaultFieldNullability'],
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
            : PrismaNextObjectRef<Types, M, Row<Types, M>>,
          Args,
          Nullable,
          IsNull,
          Selected
        >,
      ]
    >
  ): FieldRef<Types, VariantFieldShape<Types, M, Nullable>, 'PrismaNextObject'> {
    const [options = {}] = allArgs as [Record<string, unknown>?];
    const ref = refFor(this.builder, variant);
    const variantTypeName = (ref as { name: string }).name;
    const {
      isNull,
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
      select?: RawSelect;
      extensions?: Record<string, unknown>;
    };
    const forced = variantSelect
      ? splitSelect(variantSelect, getModel(this.contract as AnyContract, this.modelKey as string))
          .columns
      : [];
    const select: PrismaNextSelectFn = (_args, _ctx, nested) =>
      completeValue(nested(true), (query) => ({
        ...query,
        columns: query.columns === null ? null : [...(query.columns ?? []), ...forced],
      }));
    const fieldOpts: Record<string, unknown> = {
      ...rest,
      type: ref,
      extensions: {
        ...userExtensions,
        pothosIndirectInclude: { getType: () => variantTypeName },
        [PRISMA_NEXT_FIELD_SELECTION]: select,
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
    // The model of `type`. A variant of the target narrows the rows.
    TypeModel extends RelationTypeModel<Types, M, RelName> = RelatedModel<Types, M, RelName>,
    Nullable extends boolean = Types['DefaultFieldNullability'],
    Args extends InputFieldMap = {},
    RelatedShape = Row<Types, RelatedModel<Types, M, RelName>>,
  >(
    name: RelName,
    ...allArgs: RelationFieldArgs<
      Types,
      M,
      RelName,
      Nullable,
      Args,
      RelatedShape,
      Shape,
      Query,
      TypeModel
    >
  ): FieldRef<Types, RelationFieldShape<Types, M, RelName, Nullable>, 'PrismaNextObject'> {
    const [opts = {}] = allArgs as [
      {
        type?: object;
        query?: unknown;
        onNull?:
          | 'error'
          | ((parent: object, args: object, ctx: object, info: GraphQLResolveInfo) => unknown);
        extensions?: Record<string, unknown>;
      }?,
    ];
    const relation = this.#relation(name as string);
    const targetRef = opts.type ?? getRefFromContractModel(relation.targetModel, this.builder);
    // Throws at build time for a type the relation can't return.
    const variant = variantForRelationType(
      this.contract as AnyContract,
      `t.relation('${name as string}') on '${this.modelKey as string}'`,
      relation.targetModel,
      (targetRef as { modelKey?: string }).modelKey,
    );
    const { type: _type, query, onNull, extensions, ...rest } = opts;
    const relationName = name as string;
    // A to-one relation loads whole, keyed on the row by its name, so a variant `type` narrows it
    // by the discriminator when the field resolves rather than in the load.
    const discriminator =
      variant === undefined || relation.isToMany
        ? undefined
        : modelDiscriminator(this.contract as AnyContract, relation.targetModel)!.field;
    // A literal query is checked here, and a callback's result when a request is planned.
    const literal = typeof query === 'function' ? undefined : definedQuery(query);
    const literalRefine =
      literal &&
      queryRefinement(
        this.contract as AnyContract,
        relation.targetModel,
        literal,
        PothosSchemaError,
        orderableProblem(getPluginConfig(this.builder).context, relation.targetModel),
      );
    const relationLoaded = (parent: object) =>
      (parent as Record<string, unknown>)[relationName] !== undefined;
    const select: PrismaNextSelectFn = (args, ctx, nested, _selected, position) =>
      completeOption(query as unknown, args, ctx, (value) => {
        const spec =
          typeof value === 'function' ? undefined : value === query ? literal : definedQuery(value);
        const refine =
          typeof value === 'function'
            ? (value as (rel: MapperCollection) => MapperCollection)
            : value === query
              ? literalRefine
              : spec && queryRefinement(this.contract as AnyContract, relation.targetModel, spec);
        // A callback builds a new query on every walk, so its definition and arguments identify
        // it.
        const identity = refine && (typeof query === 'function' ? { source: query, args } : spec);
        return rowsSelection(
          relation,
          relationName,
          consumerId(position),
          nested({
            columns: discriminator === undefined ? null : [discriminator],
            args: relationArgs(relation, {
              loadIdentity: identity,
              refine,
              variant: discriminator === undefined ? variant : undefined,
            }),
          }),
        );
      });
    return this.field({
      ...rest,
      type: relation.isToMany ? [targetRef] : targetRef,
      extensions: {
        ...extensions,
        [PRISMA_NEXT_FIELD_SELECTION]: select,
      },
      resolve: (parent: object, args: object, context: object, info: GraphQLResolveInfo) =>
        readOwn(this.builder, parent, context, info, relationLoaded, (own) => {
          const rows = (own as Record<string, unknown>)[relationName] as Record<
            string,
            unknown
          > | null;
          // A variant type filters out a to-one relation's row of another variant.
          if (rows == null || (discriminator !== undefined && rows[discriminator] !== variant)) {
            return typeof onNull === 'function' ? onNull(parent, args, context, info) : null;
          }
          return completeVariantRows(
            this.builder,
            relation,
            getNamedType(info.returnType),
            context,
            info,
            rows,
          );
        }),
    } as never) as never;
  }

  /** Exposes the row count of a to-many relation as an `Int`. */
  relationCount<
    // Targets without aggregates, such as MySQL, accept no relation.
    RelName extends HasAggregates<Types> extends true ? ToManyRelationKeys<Types, M> : never,
    Where extends RelationCountWhereParam<Types, M, RelName, Args> | undefined,
    Args extends InputFieldMap = {},
  >(
    name: RelName,
    options?: PrismaNextRelationCountOptions<Types, M, RelName, Args, Shape, Where>,
  ): FieldRef<Types, number, 'PrismaNextObject'> {
    const relationName = name as string;
    // Rejects a relation several variants declare, which the types can't tell apart.
    this.#relation(relationName);
    const { where, extensions, ...rest } = (options ?? {}) as {
      where?: unknown;
      extensions?: Record<string, unknown>;
    } & Record<string, unknown>;
    const countLoaded = (parent: object) =>
      fieldValue(parent, relationName, VALUE_SLOT) !== undefined;
    const select: PrismaNextSelectFn = (args, ctx, _nested, _selected, position) =>
      completeOption(where, args, ctx, (filter) =>
        computedSelection(relationName, consumerId(position), { where, args }, (sub) => ({
          [VALUE_SLOT]: countOf(filter === undefined ? sub : sub.where(filter)),
        })),
      );
    return this.field({
      ...rest,
      type: 'Int',
      nullable: false,
      extensions: {
        ...extensions,
        [PRISMA_NEXT_FIELD_SELECTION]: select,
      },
      resolve: (parent: object, _args: object, context: object, info: GraphQLResolveInfo) =>
        readOwn(this.builder, parent, context, info, countLoaded, (own) =>
          fieldValue(own, relationName, VALUE_SLOT),
        ),
    } as never) as never;
  }

  relatedConnection: 'relay' extends PluginName
    ? <
        RelName extends ToManyRelationKeys<Types, M>,
        // The relay plugin applies the builder's default, as for any connection field.
        Nullable extends boolean = Types['DefaultFieldNullability'],
        Args extends InputFieldMap = {},
        RelatedShape = unknown,
        ConnectionInterfaces extends InterfaceParam<Types>[] = [],
        EdgeInterfaces extends InterfaceParam<Types>[] = [],
        QueryLiteral extends ConnectionQueryLiteral<
          Types,
          RelatedModel<Types, M, RelName>
        > = ConnectionQueryLiteral<Types, RelatedModel<Types, M, RelName>>,
      >(
        name: RelName,
        options: PrismaNextRelatedConnectionOptions<
          Types,
          M,
          RelName,
          Nullable,
          Args,
          RelatedShape,
          Shape,
          QueryLiteral
        >,
        connectionOptions?:
          | PothosSchemaTypes.ConnectionObjectOptions<
              Types,
              PrismaNextObjectRef<Types, RelatedModel<Types, M, RelName>, RelatedShape>,
              false,
              false,
              ConnectionResultShape<Shape, Args>,
              ConnectionInterfaces
            >
          | ObjectRef<Types, unknown>,
        edgeOptions?:
          | PothosSchemaTypes.ConnectionEdgeObjectOptions<
              Types,
              PrismaNextObjectRef<Types, RelatedModel<Types, M, RelName>, RelatedShape>,
              false,
              ConnectionResultShape<Shape, Args>,
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
    this: PrismaNextObjectFieldBuilder<SchemaTypes, ModelKey<SchemaTypes>>,
    name: string,
    options: ConnectionSettingsOptions & {
      type?: { modelKey: string };
      extensions?: Record<string, unknown>;
      [key: string]: unknown;
    },
    connectionOptions: object = {},
    edgeOptions: object = {},
  ) {
    const relation = this.#relation(name);
    const config = getPluginConfig(this.builder);
    const relatedModel = relation.targetModel;
    const targetRef = options.type ?? getRefFromContractModel(relatedModel, this.builder);
    const variant = variantForRelationType(
      config.contract,
      `t.relatedConnection('${name}') on '${this.modelKey as string}'`,
      relatedModel,
      (targetRef as { modelKey?: string }).modelKey,
    );
    const { type: _type, defaultSize, maxSize, query, totalCount, extensions, ...rest } = options;
    const settings = connectionSettings(config, relatedModel, {
      defaultSize,
      maxSize,
      totalCount,
      query,
    });
    const relatedTypeName = (targetRef as { name?: string }).name ?? relatedModel;
    const include = connectionNodes(relatedTypeName);
    // Per selection of the field. Planning decides these once, however many parent rows there are,
    // and the resolver reaches the same position through its loader mapping.
    const plans = new WeakMap<Position, ConnectionPlan>();
    const pageLoaded = (parent: object, ctx: object, info: GraphQLResolveInfo) => {
      const { needsRows, count } = settings.selectionFor(ctx, info);
      return (
        (!needsRows || (parent as Record<string, unknown>)[name] !== undefined) &&
        (count !== 'aggregate' || fieldValue(parent, name, COUNT_SLOT) !== undefined)
      );
    };
    const select: PrismaNextSelectFn = (args, ctx, nested, selectedFields, position) => {
      const planned = settings.plan(args, ctx);
      plans.set(position, planned);
      const { needsRows, count } = settings.selection(selectedFields());
      return pageSelection(relation, name, consumerId(position), {
        plan: planned,
        args,
        // The order is part of the identity, so aliases that share a slot share their order.
        identity: { source: select, args, order: planned.order },
        variant,
        count: count === 'aggregate' ? { filtered: config.filterConnectionTotalCount } : undefined,
        rows: needsRows ? (seed) => nested(seed, include) : undefined,
      });
    };

    const connectionConfig = {
      ...rest,
      type: targetRef,
      extensions: {
        ...extensions,
        pothosIndirectInclude: include,
        [PRISMA_NEXT_FIELD_SELECTION]: select,
      },
      resolve: (
        parent: object,
        args: PothosSchemaTypes.DefaultConnectionArguments,
        context: object,
        info: GraphQLResolveInfo,
      ) =>
        readOwn(
          this.builder,
          parent,
          context,
          info,
          (own) => pageLoaded(own, context, info),
          async (own) => {
            // A field that loads nothing, selecting only a count callback, has no branch.
            const branch = fieldBranch(own);
            const planned = (branch && plans.get(branch.position)) ?? settings.plan(args, context);
            const { needsRows, count } = settings.selectionFor(context, info);
            const rows = needsRows
              ? await completeVariantRows(
                  this.builder,
                  relation,
                  info.schema.getType(relatedTypeName),
                  context,
                  info,
                  (own as Record<string, unknown>)[name],
                )
              : [];
            const totalCount =
              count === 'aggregate'
                ? (fieldValue(own, name, COUNT_SLOT) as number | undefined)
                : await count?.(parent, args, context, info);
            return buildConnectionPage(rows as Record<string, unknown>[], planned, args, {
              totalCount,
              parent,
            });
          },
        ),
    };
    return (
      this as typeof this & { connection: (cfg: object, c?: object, e?: object) => unknown }
    ).connection(connectionConfig, settings.connectionOptions(connectionOptions), edgeOptions);
  } as never;

  /**
   * The planner's relation, from the root model, which has every variant's relations. Throws for a
   * name several variants declare, which the types can't tell apart from one variant's relation.
   */
  #relation(name: string): PrismaNextRelation {
    const model = getModel(this.contract as AnyContract, this.modelKey as string);
    if (model.sharedVariantRelations.has(name)) {
      throw sharedVariantRelationError(`model '${this.modelKey as string}'`, name, model);
    }
    return model.relations[name]!;
  }
}

/**
 * Reads what a field helper loaded on its parent, which `wrapResolve` handed the resolver. A plugin
 * listed after this one can replace that parent with one that lacks it, which is reloaded with
 * what the helper selects.
 */
const NO_TYPE_IDS = copyIds([]);

function readOwn<T>(
  builder: object,
  parent: object,
  context: object,
  info: GraphQLResolveInfo,
  loaded: (parent: object) => boolean,
  read: (parent: object) => T,
): MaybePromise<T> {
  if (loaded(parent)) {
    return read(parent);
  }
  const config = getPluginConfig(builder);
  const modelKey = info.parentType.extensions?.[PRISMA_NEXT_MODEL] as string;
  const model = getModel(config.contract, modelKey);
  return (
    reloadFor(info, () => config.loader(context, modelKey).loadSelection(info, rowOf(parent)))
      // A reload plans its field first, onto a level that loads nothing yet, so the field always
      // fits and has a mapping.
      .then(({ row, mapping }) => read(fieldCopy(row, model, NO_TYPE_IDS, mapping!.position!)))
  );
}
