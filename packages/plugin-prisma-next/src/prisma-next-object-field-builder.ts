import {
  type CompatibleTypes,
  completeValue,
  createContextCache,
  type ExposeNullability,
  type FieldKind,
  type FieldRef,
  type InferredFieldOptionKeys,
  type InputFieldMap,
  type InputShapeFromFields,
  type InterfaceParam,
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
  RelatedModel,
  RelationAggregateField,
  RelationAggregateOp,
  RelationAggregateResult,
  RelationFieldShape,
  RelationKeys,
  RelationNullable,
  RelationQuery,
  Row,
  ShapeFromConnection,
  ToManyRelationKeys,
} from './types.js';
import type { MapperCollection } from './utils/adapter.js';
import { getPluginConfig } from './utils/config.js';
import {
  argsKey,
  connectionNeedsRows,
  connectionSettings,
  relatedCount,
} from './utils/connections.js';
import {
  collectionForModel,
  relationVariant,
  resolveContractModel,
  rootModelKey,
  variantOf,
} from './utils/contract.js';
import {
  applyCursorPagination,
  buildConnectionPage,
  buildPaginationParams,
  normalizeCursor,
  type RequestOrderBy,
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

export class PrismaNextObjectFieldBuilder<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = unknown,
  ExposableShape = Row<Types, M>,
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
    Name extends CompatibleTypes<Types, ExposableShape, Type, Nullable>,
  >(
    // Positional so `Name extends CompatibleTypes<…>` is inferred from the call site.
    name: Name,
    ...args: NormalizeArgs<
      [
        options: ExposeNullability<Types, Type, ExposableShape, Name, Nullable> &
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
      Name extends CompatibleTypes<
        Types,
        ExposableShape,
        Type,
        Type extends [unknown] ? { list: true; items: true } : true
      >,
    >(
      name: Name,
      ...args: NormalizeArgs<
        [
          options: ExposeNullability<Types, Type, ExposableShape, Name, Nullable> &
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
            > & {
              description?: string | false;
            },
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
    Selected extends keyof Row<Types, M> & string = never,
  >(
    variant: Variant,
    options: {
      description?: string;
      nullable?: Nullable;
      args?: Args;
      select?: readonly Selected[];
      isNull?: (
        parent: Shape & Pick<Row<Types, M>, Selected>,
        args: InputShapeFromFields<Args>,
        ctx: Types['Context'],
        info: GraphQLResolveInfo,
      ) => boolean | Promise<boolean>;
    } = {},
  ): FieldRef<Types, unknown> {
    const ref =
      typeof variant === 'string'
        ? (getRefFromContractModel(variant as never, this.builder) as never)
        : variant;
    const variantTypeName =
      (ref as { name?: string; modelName?: string }).name ??
      (ref as { modelName?: string }).modelName ??
      (this.modelName as string);
    const {
      isNull,
      nullable,
      select: variantSelect,
      extensions: userExtensions,
      ...rest
    } = options as typeof options & { extensions?: Record<string, unknown> };
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
    return this.field(fieldOpts as never) as FieldRef<Types, unknown>;
  }

  relation<
    RelName extends RelationKeys<Types, M>,
    Query extends RelationQuery<Types, M, RelName, Args> | undefined,
    Nullable extends boolean = RelationNullable<Types, M, RelName, Query>,
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
      Query
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
      // A query can filter a to-one relation's row out.
      nullable:
        nullable ??
        (relation.isToMany
          ? false
          : query !== undefined ||
            this.#isToOneRelationNullable(this.#getRelationMeta(relationName))),
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
    return this.#aggregateField(name as string, 'count', undefined, options ?? {}, false) as never;
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
    return this.#aggregateField(
      name as string,
      op,
      field,
      rest,
      op !== 'count' && op !== 'countBigInt',
    ) as never;
  }

  #aggregateField(
    name: string,
    op: string,
    field: string | undefined,
    options: Record<string, unknown>,
    nullableDefault: boolean,
  ): FieldRef<Types, unknown, 'PrismaNextObject'> {
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
      nullable: nullable ?? nullableDefault,
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
        Nullable extends boolean = false,
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
      refine?: (rel: unknown, args: unknown, ctx: unknown) => unknown;
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
    const cursorOpt = validateCursor(config.contract, relatedKey, options.cursor);
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
      where,
      orderBy,
      totalCount,
      extensions,
      ...rest
    } = options as typeof options & {
      where?: unknown;
      orderBy?: (model: never, args: unknown, ctx: unknown) => ReturnType<RequestOrderBy>;
    };
    const settings = connectionSettings(config, { defaultSize, maxSize, totalCount });
    const relatedTypeName = (targetRef as { name?: string }).name ?? relatedKey;
    const include: IndirectInclude = {
      getType: () => relatedTypeName,
      paths: [[{ name: 'edges' }, { name: 'node' }], [{ name: 'nodes' }]],
    };
    const cursorColumns = normalizeCursor(cursorOpt);
    const filter = (rel: MapperCollection, args: object, ctx: object) =>
      where === undefined ? rel : rel.where(whereInput(where, args, ctx));
    const narrow = (rel: MapperCollection) => (variant === undefined ? rel : rel.variant(variant));
    const page = (rel: MapperCollection, args: object, ctx: object) =>
      applyCursorPagination(
        filter(rel, args, ctx),
        cursorOpt,
        args as PothosSchemaTypes.DefaultConnectionArguments,
        {
          ...settings.sizes(args, ctx),
          codecs: config.codecs(ctx, relatedKey),
          orderBy: orderBy && ((model) => orderBy(model as never, args, ctx)),
        },
      ).collection;
    const targetVariant = variant ?? variantOf(config.contract, relatedKey)?.value;
    // What depends on the request (the cursor arguments, and the size, `where` and `orderBy`
    // callbacks) is checked once per request and set of arguments, which every parent row shares,
    // by building the page on the related model's collection without running it.
    // Keyed on the args object too, so a row's LOADED check and resolve serialize it once.
    const planErrors = createContextCache(() => ({
      byValue: new Map<string, { error: unknown } | null>(),
      byArgs: new WeakMap<object, { error: unknown } | null>(),
    }));
    const planError = (args: object, ctx: object) => {
      const { byValue, byArgs } = planErrors(ctx);
      let failure = byArgs.get(args);
      if (failure !== undefined) {
        return failure;
      }
      const key = argsKey(args);
      failure = key === undefined ? undefined : byValue.get(key);
      if (failure === undefined) {
        failure = null;
        try {
          validateCursorArgs(
            cursorOpt,
            args as PothosSchemaTypes.DefaultConnectionArguments,
            config.codecs(ctx, relatedKey),
          );
          // A client may expose the related model only through its parent's relation.
          const base = collectionForModel(
            config.contract,
            config.client(ctx).orm,
            rootModelKey(config.contract, relatedKey),
          ) as MapperCollection | undefined;
          if (base) {
            page(targetVariant === undefined ? base : base.variant(targetVariant), args, ctx);
          }
        } catch (error) {
          failure = { error };
        }
        if (key !== undefined) {
          byValue.set(key, failure);
        }
      }
      byArgs.set(args, failure);
      return failure;
    };
    // A request that can't be planned plans nothing, so the error surfaces on this field when it
    // resolves instead of failing the parent's query.
    const select: PrismaNextSelectFn = (args, ctx, nested, selectedFields, position) => {
      if (planError(args, ctx)) {
        return {};
      }
      const identity = { source: select, args };
      const selected = selectedFields();
      const count =
        totalCount === true && selected.has('totalCount')
          ? computedSelection(name, scopeOf(position), identity, (sub) => ({
              count: relatedCount(filter(narrow(sub), args, ctx)),
            }))
          : {};
      if (![...selected].some((field) => field !== 'totalCount' && field !== '__typename')) {
        return count;
      }
      const rows = nested(
        {
          columns: cursorColumns,
          args: relationArgs(relation, identity, (rel) => page(rel, args, ctx), variant),
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
          !!planError(args, ctx) ||
          ((!connectionNeedsRows(ctx, info) || view[name] !== undefined) &&
            (!settings.countsRows(ctx, info) || Object.hasOwn(view, 'count'))),
      },
      resolve: async (
        parent: Record<string, unknown>,
        args: PothosSchemaTypes.DefaultConnectionArguments,
        context: object,
        info: GraphQLResolveInfo,
      ) => {
        const failure = planError(args, context);
        if (failure) {
          throw failure.error;
        }
        const rows = connectionNeedsRows(context, info) ? parent[name] : [];
        const pagination = buildPaginationParams(cursorOpt, args, {
          ...settings.sizes(args, context),
          codecs: config.codecs(context, relatedKey),
        });
        const totalCount = settings.countsRows(context, info)
          ? (parent.count as number | undefined)
          : settings.callsCount(context, info)
            ? await settings.countCallback!(parent, args, context, info)
            : undefined;
        return buildConnectionPage(rows as Record<string, unknown>[], pagination, totalCount);
      },
    };
    return (
      this as typeof this & { connection: (cfg: object, c?: object, e?: object) => unknown }
    ).connection(connectionConfig, settings.connectionOptions(connectionOptions), edgeOptions);
  } as never;

  #relation(name: string): PrismaNextRelation {
    this.#getRelationMeta(name);
    return getModel(this.contract as AnyContract, this.modelName as string).relations[name]!;
  }

  #getRelationMeta(relationName: string): ContractRelation {
    const model = resolveContractModel(this.contract as AnyContract, this.modelName as string);
    if (!model) {
      throw new PothosSchemaError(`Model '${this.modelName as string}' not found in contract.`);
    }
    const rel = model.relations[relationName];
    if (!rel) {
      throw new PothosSchemaError(
        `Relation '${relationName}' not found on model '${this.modelName as string}'. ` +
          `Available: ${Object.keys(model.relations).join(', ') || '(none)'}`,
      );
    }
    return rel;
  }

  // Nullable if any FK column is, or when the FK columns aren't recorded (embeds).
  #isToOneRelationNullable(meta: ContractRelation): boolean {
    if ('nullable' in meta && typeof meta.nullable === 'boolean') {
      return meta.nullable;
    }
    const local = 'on' in meta ? meta.on.localFields : undefined;
    if (!local || local.length === 0) {
      return true;
    }
    const fields = resolveContractModel(
      this.contract as AnyContract,
      this.modelName as string,
    )?.fields;
    if (!fields) {
      return true;
    }
    for (const fk of local) {
      const f = fields[fk];
      if (!f || f.nullable !== false) {
        return true;
      }
    }
    return false;
  }
}
