import {
  type CompatibleTypes,
  type ExposeNullability,
  type FieldKind,
  type FieldRef,
  type InferredFieldOptionKeys,
  type InputFieldMap,
  isThenable,
  type NormalizeArgs,
  type PluginName,
  PothosSchemaError,
  PothosValidationError,
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import { type IndirectInclude, selectedFieldNames } from '@pothos/selection-mapper';
import type { ContractRelation } from '@prisma/orm-framework/contract/types';
import type { GraphQLResolveInfo } from 'graphql';
import { PRISMA_NEXT_FIELD_SELECT } from './constants.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type {
  AnyContract,
  CursorSpec,
  DefaultRelationNullable,
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
  RelationKeys,
  Row,
  ToManyRelationKeys,
} from './types.js';
import {
  type MapperCollection,
  narrowToVariant,
  type PrismaNextSelectFn,
  type PrismaNextSpec,
} from './utils/adapter.js';
import { rebrandForVariant } from './utils/branding.js';
import { compileWhere } from './utils/compile-query.js';
import {
  relatedModelKey,
  relationVariant,
  resolveContractModel,
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
import { readPluginOptions, resolveSizeOption } from './utils/options.js';
import { getRefForContractModel, getRefFromContractModel } from './utils/refs.js';
import {
  connectionNeedsRows,
  relatedCount,
  wrapConnectionOptionsWithTotalCount,
} from './utils/total-count.js';

function isToManyCardinality(cardinality: string): boolean {
  return cardinality !== '1:1' && cardinality !== 'N:1';
}

function isEmptyDeclarative(value: unknown): boolean {
  if (value == null) {
    return true;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const options = value as Record<string, unknown>;
  return Object.keys(options).every(
    (key) =>
      (key === 'where' || key === 'orderBy' || key === 'limit' || key === 'offset') &&
      options[key] === undefined,
  );
}

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
  ) {
    super(builder, 'PrismaNextObject' as never, 'Object');
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
    return (
      this as unknown as {
        exposeField: (name: never, options: never) => FieldRef<Types, unknown, 'PrismaNextObject'>;
      }
    ).exposeField(name as never, options as never) as FieldRef<
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
        args: import('@pothos/core').InputShapeFromFields<Args>,
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
    const pothosIndirectInclude = {
      getType: () => variantTypeName,
    };
    const fieldOpts: Record<string, unknown> = {
      ...rest,
      type: ref,
      nullable: (nullable ?? !!isNull) as never,
      extensions: { ...userExtensions, pothosIndirectInclude },
      resolve: isNull
        ? async (
            parent: unknown,
            args: unknown,
            ctx: Types['Context'],
            info: GraphQLResolveInfo,
          ) => {
            const result = await isNull(parent as never, args as never, ctx, info);
            return result ? null : rebrandForVariant(parent, variantTypeName);
          }
        : (parent: unknown) => rebrandForVariant(parent, variantTypeName) as never,
    };
    if (variantSelect !== undefined && variantSelect.length > 0) {
      fieldOpts.select = variantSelect;
    }
    return this.field(fieldOpts as never) as FieldRef<Types, unknown>;
  }

  relation<
    RelName extends RelationKeys<Types, M>,
    Nullable extends boolean = DefaultRelationNullable<Types, M, RelName>,
    Args extends InputFieldMap = {},
    RelatedShape = Row<Types, RelatedModel<Types, M, RelName>>,
  >(
    name: RelName,
    options?: PrismaNextRelationOptions<Types, M, RelName, Nullable, Args, RelatedShape, Shape>,
  ): FieldRef<Types, unknown> {
    const opts = (options ?? {}) as PrismaNextRelationOptions<
      Types,
      M,
      RelName,
      Nullable,
      Args,
      RelatedShape
    > & { extensions?: Record<string, unknown> };
    const meta = this.#getRelationMeta(name as string);
    const targetRef =
      opts.type ??
      (getRefForContractModel(
        relatedModelKey(this.contract as AnyContract, meta.to) as never,
        this.builder,
      ) as never);
    // Throws at build time for a type the relation can't return.
    relationVariant(
      this.contract as AnyContract,
      `t.relation('${name as string}') on '${this.modelName as string}'`,
      relatedModelKey(this.contract as AnyContract, meta.to),
      (targetRef as { modelName?: string }).modelName,
    );
    const isToMany = isToManyCardinality(meta.cardinality);
    const defaultNullable = isToMany ? false : this.#isToOneRelationNullable(meta);

    const relationName = name as string;
    const userQuery = (opts as { query?: unknown }).query;
    const {
      type: _type,
      query: _query,
      nullable,
      extensions,
      ...rest
    } = opts as PrismaNextRelationOptions<Types, M, RelName, Nullable, Args, RelatedShape> & {
      query?: unknown;
      extensions?: Record<string, unknown>;
    };
    const select =
      userQuery === undefined
        ? { [relationName]: true }
        : typeof userQuery === 'function'
          ? (args: unknown, ctx: unknown) => {
              const literal = (userQuery as (a: unknown, c: unknown) => unknown)(args, ctx);
              if (literal == null || isEmptyDeclarative(literal)) {
                return { [relationName]: true };
              }
              return { [relationName]: literal as Record<string, unknown> };
            }
          : isEmptyDeclarative(userQuery)
            ? { [relationName]: true }
            : { [relationName]: userQuery as Record<string, unknown> };
    const fieldOpts = {
      ...rest,
      type: isToMany ? [targetRef] : targetRef,
      nullable: nullable ?? defaultNullable,
      select,
      ...(extensions !== undefined ? { extensions } : {}),
      resolve: (parent: unknown, _args: unknown, _ctx: unknown, info: GraphQLResolveInfo) => {
        const value = (parent as Record<string, unknown>)[relationName];
        if (value === undefined) {
          // A missing key means the include never ran, unlike a loaded null.
          throw new PothosValidationError(
            `Relation '${info.parentType.name}.${info.fieldName}' was reached from a parent not loaded by t.prismaField. ` +
              'Use t.prismaField as the entry point so the auto-include mapper can preload this relation.',
          );
        }
        return value;
      },
    };
    return this.field(fieldOpts as never) as FieldRef<Types, unknown>;
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
    const { where, nullable, ...rest } = options as {
      where?: unknown;
      nullable?: boolean;
    } & Record<string, unknown>;
    const reduce = (rel: MapperCollection): unknown => {
      const reducer = (rel as unknown as Record<string, unknown>)[op];
      if (typeof reducer !== 'function') {
        throw new PothosSchemaError(`Aggregate '${op}' is not available on this ORM collection.`);
      }
      return field === undefined ? reducer.call(rel) : reducer.call(rel, field);
    };
    const select = (args: unknown, ctx: unknown) => ({
      [name]: (sub: MapperCollection) => {
        if (where === undefined) {
          return { [name]: reduce(sub) };
        }
        const refined =
          typeof where === 'function'
            ? (sub.where((accessor: unknown, tools: unknown) =>
                (where as (a: unknown, args: unknown, c: unknown, t: unknown) => unknown)(
                  accessor,
                  args,
                  ctx,
                  tools,
                ),
              ) as MapperCollection)
            : (sub.where(where) as MapperCollection);
        return { [name]: reduce(refined) };
      },
    });
    const fieldOpts = {
      ...rest,
      type: options.type ?? (op === 'count' ? 'Int' : 'Float'),
      nullable: nullable ?? nullableDefault,
      select,
      resolve: (parent: unknown) => (parent as Record<string, unknown>)[name],
    };
    return this.field(fieldOpts as never) as FieldRef<Types, unknown, 'PrismaNextObject'>;
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
        ConnectionInterfaces extends import('@pothos/core').InterfaceParam<Types>[] = [],
        EdgeInterfaces extends import('@pothos/core').InterfaceParam<Types>[] = [],
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
          | import('@pothos/core').ObjectRef<Types, unknown>,
        edgeOptions?:
          | PothosSchemaTypes.ConnectionEdgeObjectOptions<
              Types,
              PrismaNextObjectRef<Types, RelatedModel<Types, M, RelName>, RelatedShape>,
              false,
              unknown,
              EdgeInterfaces
            >
          | import('@pothos/core').ObjectRef<Types, unknown>,
      ) => FieldRef<Types, unknown>
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
    const meta = this.#getRelationMeta(name);
    if (!isToManyCardinality(meta.cardinality)) {
      throw new PothosSchemaError(
        `t.relatedConnection('${name}') is only valid on to-many relations; ` +
          `'${this.modelName as string}.${name}' has cardinality '${meta.cardinality}'.`,
      );
    }
    const pluginOpts = readPluginOptions(this.builder);
    const relatedKey = relatedModelKey(this.contract as AnyContract, meta.to);
    const cursorOpt = validateCursor(
      this.contract as AnyContract,
      relatedKey,
      options.cursor,
      pluginOpts?.context,
    );
    const targetRef =
      options.type ?? getRefForContractModel(relatedKey as never, this.builder as never);
    const variant = relationVariant(
      this.contract as AnyContract,
      `t.relatedConnection('${name}') on '${this.modelName as string}'`,
      relatedKey,
      (targetRef as { modelName?: string }).modelName,
    );
    const targetVariant = variantOf(this.contract as AnyContract, relatedKey);

    const self = this as unknown as {
      connection: (cfg: object, c?: object, e?: object) => unknown;
    };

    const relationName = name;
    const totalCountCallback =
      typeof options.totalCount === 'function'
        ? (options.totalCount as (
            parent: unknown,
            args: unknown,
            ctx: unknown,
            info: GraphQLResolveInfo,
          ) => number | Promise<number>)
        : undefined;
    const totalCountFlag = options.totalCount === true;
    const totalCountEnabled = totalCountFlag || totalCountCallback !== undefined;
    const refine = compileWhere((options as { where?: unknown }).where);
    const {
      cursor: _cursor,
      type: _type,
      defaultSize,
      maxSize,
      where: _where,
      orderBy,
      totalCount: _totalCount,
      extensions: userExtensions,
      ...rest
    } = options as typeof options & {
      where?: unknown;
      orderBy?: (model: never, args: unknown, ctx: unknown) => ReturnType<RequestOrderBy>;
    };
    const fallbackDefault = pluginOpts?.defaultConnectionSize;
    const fallbackMax = pluginOpts?.maxConnectionSize;
    const relatedTypeName = (targetRef as { name?: string }).name ?? relatedKey;

    const pothosIndirectInclude: IndirectInclude = {
      getType: () => relatedTypeName,
      paths: [[{ name: 'edges' }, { name: 'node' }], [{ name: 'nodes' }]],
    };
    const cursorCols = normalizeCursor(cursorOpt);

    // Combine slots `<alias>:rows` and `<alias>:count` are lifted onto the parent by the overlay.
    const select: PrismaNextSelectFn = (args, ctx, nested, selectedFieldNode) => {
      try {
        validateCursorArgs(
          cursorOpt,
          args as import('@pothos/plugin-relay').DefaultConnectionArguments,
        );
      } catch (error) {
        if (error instanceof PothosValidationError) {
          return {};
        }
        throw error;
      }
      const filter = (rel: MapperCollection) =>
        refine != null ? (refine(rel, args, ctx) as MapperCollection) : rel;
      const narrow = (rel: MapperCollection) =>
        variant === undefined ? rel : narrowToVariant(rel, variant);
      const selectedFields = selectedFieldNode();
      const wantsTotalCount = totalCountFlag && selectedFields.has('totalCount');
      const wantsRows = [...selectedFields].some(
        (field) => field !== 'totalCount' && field !== '__typename',
      );
      const count = {
        fn: (sub: MapperCollection) => ({ count: relatedCount(filter(narrow(sub))) }),
        args: args as Record<string, unknown>,
      };
      if (!wantsRows) {
        return wantsTotalCount ? { relations: { [relationName]: count } } : {};
      }
      const resolvedDefault = resolveSizeOption(defaultSize, args, ctx) ?? fallbackDefault;
      const resolvedMax = resolveSizeOption(maxSize, args, ctx) ?? fallbackMax;
      const selection = nested(
        {
          slot: 'rows',
          ...(targetVariant
            ? { variant: targetVariant.value, variantModel: relatedKey }
            : variant !== undefined
              ? { variant }
              : {}),
          columns: cursorCols,
          refine: (rel) =>
            applyCursorPagination(
              filter(rel),
              cursorOpt,
              args as import('@pothos/plugin-relay').DefaultConnectionArguments,
              {
                ...(resolvedDefault !== undefined ? { defaultSize: resolvedDefault } : {}),
                ...(resolvedMax !== undefined ? { maxSize: resolvedMax } : {}),
                orderBy: orderBy && ((model) => orderBy(model as never, args, ctx)),
              },
            ).collection,
        },
        pothosIndirectInclude,
      ) as PrismaNextSpec | PromiseLike<PrismaNextSpec>;
      const finish = (selected: PrismaNextSpec): PrismaNextSpec => {
        const rows = { ...selected, args: args as Record<string, unknown> };
        return {
          relations: {
            [relationName]: wantsTotalCount ? [rows, count] : rows,
          },
        };
      };
      return isThenable(selection) ? Promise.resolve(selection).then(finish) : finish(selection);
    };

    const connectionConfig = {
      ...rest,
      type: targetRef,
      extensions: {
        ...userExtensions,
        pothosIndirectInclude,
        [PRISMA_NEXT_FIELD_SELECT]: select,
      },
      resolve: async (
        parent: unknown,
        args: unknown,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => {
        // Planning ignores invalid cursor args, so the error surfaces on this field only.
        validateCursorArgs(
          cursorOpt,
          args as import('@pothos/plugin-relay').DefaultConnectionArguments,
        );
        // Lifted slots are own properties of the overlay; the row (which may have its own
        // `rows` or `count` column) is its prototype.
        const p = parent as { [key: string]: unknown };
        const rows = connectionNeedsRows(context as object, info)
          ? Object.hasOwn(p, 'rows')
            ? p.rows
            : p[relationName]
          : [];
        if (rows === undefined) {
          throw new PothosValidationError(
            `relatedConnection '${info.parentType.name}.${info.fieldName}' was reached from a parent not loaded by t.prismaField. ` +
              'Use t.prismaField as the entry point so the auto-include mapper can preload this relation.',
          );
        }
        if (!Array.isArray(rows)) {
          throw new PothosValidationError(
            `relatedConnection '${info.parentType.name}.${info.fieldName}' expected an array on parent, got ${typeof rows}.`,
          );
        }
        const resolvedDefault = resolveSizeOption(defaultSize, args, context) ?? fallbackDefault;
        const resolvedMax = resolveSizeOption(maxSize, args, context) ?? fallbackMax;
        const pagination = buildPaginationParams(
          cursorOpt,
          args as import('@pothos/plugin-relay').DefaultConnectionArguments,
          {
            ...(resolvedDefault !== undefined ? { defaultSize: resolvedDefault } : {}),
            ...(resolvedMax !== undefined ? { maxSize: resolvedMax } : {}),
          },
        );
        const page = buildConnectionPage(rows as Record<string, unknown>[], pagination);
        if (totalCountFlag) {
          if (Object.hasOwn(p, 'count')) {
            (page as { totalCount?: number }).totalCount = p.count as number;
          }
        } else if (
          totalCountCallback &&
          selectedFieldNames(context as object, info).has('totalCount')
        ) {
          (page as { totalCount?: number }).totalCount = await totalCountCallback(
            parent,
            args,
            context,
            info,
          );
        }
        return page;
      },
    };
    const finalConnectionOptions = totalCountEnabled
      ? wrapConnectionOptionsWithTotalCount(connectionOptions)
      : connectionOptions;
    return self.connection(connectionConfig as never, finalConnectionOptions, edgeOptions);
  } as never;

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
