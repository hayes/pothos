import {
  type CompatibleTypes,
  type ExposeNullability,
  type FieldKind,
  type FieldRef,
  type InferredFieldOptionKeys,
  type InputFieldMap,
  type NormalizeArgs,
  type PluginName,
  PothosSchemaError,
  PothosValidationError,
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import type { ContractRelation } from '@prisma-next/contract/types';
import type { GraphQLResolveInfo } from 'graphql';
import { PRISMA_NEXT_FIELD_OP } from './constants';
import type {
  AggregateFieldOp,
  CountFieldOp,
  IncludeFieldOp,
  PaginatedIncludeFieldOp,
  SameRowFieldOp,
} from './extensions';
import type { PrismaNextObjectRef } from './object-ref';
import type {
  AnyContract,
  CursorSpec,
  DefaultRelationNullable,
  ModelName,
  PrismaNextRelatedConnectionOptions,
  PrismaNextRelatedFieldOptions,
  PrismaNextRelationCountOptions,
  PrismaNextRelationOptions,
  RelatedModel,
  RelationKeys,
  ToManyRelationKeys,
} from './types';
import { rebrandForVariant } from './utils/branding';
import { compileQuery, compileWhere } from './utils/compile-query';
import { buildConnectionPage, buildPaginationParams } from './utils/cursors';
import { readPluginOptions, resolveSizeOption } from './utils/options';
import { assertNoVariantOnlyRegistration, getRefFromContractModel } from './utils/refs';
import { getCombineSpecValue, getRelationValue } from './utils/relation-value';
import { selectionIncludesField } from './utils/selection-walk';
import { wrapConnectionOptionsWithTotalCount } from './utils/total-count';

// Per-builder counter for `totalCountAlias` so two relatedConnections
// on the same relation get distinct combine-spec keys. WeakMap-keyed so
// counts reset on rebuild (tests, HMR) instead of growing unboundedly.
const builderTotalCountSeq = new WeakMap<object, { count: number }>();
function nextTotalCountSeq(builder: object): number {
  let cell = builderTotalCountSeq.get(builder);
  if (!cell) {
    cell = { count: 0 };
    builderTotalCountSeq.set(builder, cell);
  }
  return ++cell.count;
}

function isToManyCardinality(cardinality: string): boolean {
  return cardinality !== '1:1' && cardinality !== 'N:1';
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

// Cast `RootFieldBuilder` to a parameterized constructor so methods
// pick up the right `FieldOptionsByKind` entry. Runtime is unchanged.
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
  ExposableShape = import('./types').Row<Types, M>,
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
        M,
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
    ...args: NormalizeArgs<
      [
        name: Name,
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
    const [name, options = {} as never] = args;
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
      ...args: NormalizeArgs<
        [
          name: Name,
          options: ExposeNullability<Types, Type, ExposableShape, Name, Nullable> &
            Omit<
              PothosSchemaTypes.ObjectFieldOptions<
                Types,
                ExposableShape,
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
      const [name, options = {} as never] = args;
      return this.expose(name as never, { ...options, type } as never) as never;
    };
  }

  variant<
    Variant extends PrismaNextObjectRef<Types, M, unknown> | M,
    Args extends InputFieldMap = {},
    Nullable extends boolean = false,
  >(
    variant: Variant,
    options: {
      description?: string;
      nullable?: Nullable;
      args?: Args;
      select?: readonly (keyof import('./types').Row<Types, M> & string)[];
      isNull?: (
        parent: import('./types').Row<Types, M>,
        args: import('@pothos/core').InputShapeFromFields<Args>,
        ctx: Types['Context'],
        info: GraphQLResolveInfo,
      ) => boolean | Promise<boolean>;
    } = {},
  ): FieldRef<Types, unknown> {
    if (typeof variant === 'string') {
      assertNoVariantOnlyRegistration(variant, this.builder, 't.variant', 'object');
    }
    const ref =
      typeof variant === 'string'
        ? (getRefFromContractModel(variant as never, this.builder) as never)
        : variant;
    const variantTypeName =
      (ref as { name?: string; modelName?: string }).name ??
      (ref as { modelName?: string }).modelName ??
      (this.modelName as string);
    const op: SameRowFieldOp = {
      kind: 'sameRow',
      typeName: variantTypeName,
      ...(options.select !== undefined ? { select: options.select } : {}),
    };
    const {
      isNull,
      nullable,
      select: _select,
      extensions: userExtensions,
      ...rest
    } = options as typeof options & { extensions?: Record<string, unknown> };
    if (isNull && nullable === false) {
      throw new PothosSchemaError(
        `t.variant on '${variantTypeName}': \`isNull\` can return null, but \`nullable: false\` was set. Either drop \`nullable: false\` or remove \`isNull\`.`,
      );
    }
    return this.field({
      ...rest,
      type: ref,
      nullable: (nullable ?? !!isNull) as never,
      extensions: { ...userExtensions, [PRISMA_NEXT_FIELD_OP]: op },
      resolve: isNull
        ? ((async (
            parent: unknown,
            args: unknown,
            ctx: Types['Context'],
            info: GraphQLResolveInfo,
          ) => {
            const result = await isNull(parent as never, args as never, ctx, info);
            return result ? null : rebrandForVariant(parent, variantTypeName);
          }) as never)
        : (parent: unknown) => rebrandForVariant(parent, variantTypeName) as never,
    } as never) as FieldRef<Types, unknown>;
  }

  relation<
    RelName extends RelationKeys<Types, M>,
    Nullable extends boolean = DefaultRelationNullable<Types, M, RelName>,
    Args extends InputFieldMap = {},
    RelatedShape = import('./types').Row<Types, RelatedModel<Types, M, RelName>>,
  >(
    name: RelName,
    options?: PrismaNextRelationOptions<Types, M, RelName, Nullable, Args, RelatedShape>,
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
    if (!opts.type) {
      assertNoVariantOnlyRegistration(
        meta.to as string,
        this.builder,
        `t.relation('${name as string}')`,
        'object',
      );
    }
    const targetRef =
      opts.type ?? (getRefFromContractModel(meta.to as never, this.builder) as never);
    const isToMany = isToManyCardinality(meta.cardinality);
    const defaultNullable = isToMany ? false : this.#isToOneRelationNullable(meta);

    const relationName = name as string;
    const refine = compileQuery((opts as { query?: unknown }).query);
    const op: IncludeFieldOp = {
      kind: 'include',
      relationName,
      parentModel: this.modelName as string,
      isToMany,
      ...(refine !== undefined ? { refine } : {}),
    };
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
    const fieldOpts = {
      ...rest,
      type: isToMany ? [targetRef] : targetRef,
      nullable: nullable ?? defaultNullable,
      extensions: { ...extensions, [PRISMA_NEXT_FIELD_OP]: op },
      resolve: (parent: unknown, _args: unknown, _ctx: unknown, info: GraphQLResolveInfo) => {
        const value = getRelationValue(parent, info, relationName, isToMany);
        if (value === undefined) {
          // Missing key on parent (include never ran) vs. DB null on a
          // loaded relation are different bugs. The former is almost
          // always a user error — forgot `apply(...)` in the parent
          // resolve — and a generic null error would mislead.
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

  relatedField<
    RelName extends RelationKeys<Types, M>,
    Type extends TypeParam<Types>,
    Nullable extends import('@pothos/core').FieldNullability<Type>,
    Args extends InputFieldMap = {},
    ResolveReturnShape = unknown,
  >(
    name: RelName,
    options: PrismaNextRelatedFieldOptions<
      Types,
      M,
      RelName,
      Type,
      Nullable,
      Args,
      ResolveReturnShape
    >,
  ): FieldRef<Types, ResolveReturnShape> {
    const opts = options as PrismaNextRelatedFieldOptions<
      Types,
      M,
      RelName,
      Type,
      Nullable,
      Args,
      ResolveReturnShape
    > & { extensions?: Record<string, unknown> };
    const meta = this.#getRelationMeta(name as string);
    const isToMany = isToManyCardinality(meta.cardinality);
    const relationName = name as string;
    const refine = compileQuery((opts as { query?: unknown }).query);
    const op: IncludeFieldOp = {
      kind: 'include',
      relationName,
      parentModel: this.modelName as string,
      isToMany,
      ...(refine !== undefined ? { refine } : {}),
    };
    const {
      query: _query,
      resolve,
      extensions,
      ...rest
    } = opts as typeof opts & {
      query?: unknown;
    };
    return this.field({
      ...rest,
      extensions: { ...extensions, [PRISMA_NEXT_FIELD_OP]: op },
      resolve: (parent: unknown, fieldArgs: unknown, ctx: unknown, info: GraphQLResolveInfo) => {
        const value = getRelationValue(parent, info, relationName, isToMany);
        if (value === undefined) {
          throw new PothosValidationError(
            `relatedField '${info.parentType.name}.${info.fieldName}' was reached from a parent not loaded by t.prismaField.`,
          );
        }
        return resolve(value as never, fieldArgs as never, ctx as Types['Context'], info);
      },
    } as never) as FieldRef<Types, ResolveReturnShape>;
  }

  relationCount<RelName extends ToManyRelationKeys<Types, M>, Args extends InputFieldMap = {}>(
    name: RelName,
    options?: PrismaNextRelationCountOptions<Types, M, RelName, Args>,
  ): FieldRef<Types, number> {
    const opts = (options ?? {}) as PrismaNextRelationCountOptions<Types, M, RelName, Args> & {
      extensions?: Record<string, unknown>;
    };
    this.#getRelationMeta(name as string);

    const relationName = name as string;
    const op: CountFieldOp = {
      kind: 'count',
      relationName,
      parentModel: this.modelName as string,
      ...(opts.where !== undefined ? { where: opts.where as never } : {}),
    };
    const { where: _where, extensions, nullable, ...rest } = opts;
    const fieldOpts = {
      ...rest,
      type: 'Int',
      nullable: nullable ?? false,
      extensions: { ...extensions, [PRISMA_NEXT_FIELD_OP]: op },
      resolve: (parent: unknown, _args: unknown, _ctx: unknown, info: GraphQLResolveInfo) => {
        const value = getCombineSpecValue(parent, info, relationName);
        if (value === undefined) {
          throw new PothosValidationError(
            `relationCount '${info.parentType.name}.${info.fieldName}' was reached from a parent not loaded by t.prismaField.`,
          );
        }
        return value;
      },
    };
    return this.field(fieldOpts as never) as FieldRef<Types, number>;
  }

  relationAggregate<
    RelName extends ToManyRelationKeys<Types, M>,
    Type extends TypeParam<Types>,
    Nullable extends import('@pothos/core').FieldNullability<Type>,
    Args extends InputFieldMap = {},
    ResolveReturnShape = unknown,
  >(
    name: RelName,
    options: Omit<
      PothosSchemaTypes.ObjectFieldOptions<
        Types,
        import('./types').Row<Types, M>,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      >,
      'type' | 'resolve' | InferredFieldOptionKeys
    > & {
      type: Type;
      args?: Args;
      where?:
        | import('@prisma-next/sql-orm-client').ShorthandWhereFilter<
            Types['PrismaNextContract'],
            RelatedModel<Types, M, RelName>
          >
        | ((
            accessor: import('@prisma-next/sql-orm-client').ModelAccessor<
              Types['PrismaNextContract'],
              RelatedModel<Types, M, RelName>
            >,
            args: import('@pothos/core').InputShapeFromFields<Args>,
            context: Types['Context'],
          ) => unknown);
      aggregate: (
        relation: import('./types').RelationRefinementCollection<Types, M, RelName>,
        args: import('@pothos/core').InputShapeFromFields<Args>,
        context: Types['Context'],
      ) => { readonly kind: 'includeScalar' };
      resolve?: (
        value: number | null,
        args: import('@pothos/core').InputShapeFromFields<Args>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => import('@pothos/core').MaybePromise<ResolveReturnShape>;
    },
  ): FieldRef<Types, ResolveReturnShape> {
    this.#getRelationMeta(name as string);
    const relationName = name as string;
    const userWhere = (options as { where?: unknown }).where;
    const op: AggregateFieldOp = {
      kind: 'aggregate',
      relationName,
      parentModel: this.modelName as string,
      aggregate: options.aggregate as never,
      ...(userWhere !== undefined ? { where: userWhere } : {}),
    };
    const {
      aggregate: _aggregate,
      where: _where,
      resolve,
      ...rest
    } = options as typeof options & {
      where?: unknown;
      extensions?: Record<string, unknown>;
    };
    const extensions = (rest as { extensions?: Record<string, unknown> }).extensions;
    const fieldOpts = {
      ...rest,
      extensions: { ...extensions, [PRISMA_NEXT_FIELD_OP]: op },
      resolve: (parent: unknown, fieldArgs: unknown, ctx: unknown, info: GraphQLResolveInfo) => {
        const value = getCombineSpecValue(parent, info, relationName);
        if (value === undefined) {
          throw new PothosValidationError(
            `relationAggregate '${info.parentType.name}.${info.fieldName}' was reached from a parent not loaded by t.prismaField.`,
          );
        }
        return resolve
          ? resolve(value as number | null, fieldArgs as never, ctx as Types['Context'], info)
          : (value as never);
      },
    };
    return this.field(fieldOpts as never) as FieldRef<Types, ResolveReturnShape>;
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
          RelatedShape
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
    if (!options.type) {
      assertNoVariantOnlyRegistration(
        meta.to as string,
        this.builder,
        `t.relatedConnection('${name}')`,
        'object',
      );
    }
    const targetRef =
      options.type ?? getRefFromContractModel(meta.to as never, this.builder as never);

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
    // Per-field unique alias so two relatedConnections on the same
    // relation don't collide in the parent's combine spec.
    const totalCountAlias =
      options.totalCount === true
        ? `__pn_totalCount_${name}_${nextTotalCountSeq(this.builder as object)}`
        : undefined;
    const totalCountEnabled = totalCountAlias !== undefined || totalCountCallback !== undefined;
    const refine = compileWhere((options as { where?: unknown }).where);
    const op: PaginatedIncludeFieldOp = {
      kind: 'paginatedInclude',
      relationName,
      parentModel: this.modelName as string,
      cursor: options.cursor,
      paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
      ...(totalCountAlias ? { totalCountAlias } : {}),
      ...(options.defaultSize !== undefined ? { defaultSize: options.defaultSize } : {}),
      ...(options.maxSize !== undefined ? { maxSize: options.maxSize } : {}),
      ...(refine !== undefined ? { refine } : {}),
    };
    const {
      cursor: _cursor,
      type: _type,
      defaultSize,
      maxSize,
      where: _where,
      totalCount: _totalCount,
      extensions,
      ...rest
    } = options as typeof options & { where?: unknown };
    const pluginOpts = readPluginOptions(this.builder);
    const fallbackDefault = pluginOpts?.defaultConnectionSize;
    const fallbackMax = pluginOpts?.maxConnectionSize;
    const connectionConfig = {
      ...rest,
      type: targetRef,
      extensions: { ...extensions, [PRISMA_NEXT_FIELD_OP]: op },
      resolve: async (
        parent: unknown,
        args: unknown,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => {
        const rows = getRelationValue(parent, info, relationName, true);
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
          options.cursor,
          args as import('@pothos/plugin-relay').DefaultConnectionArguments,
          {
            ...(resolvedDefault !== undefined ? { defaultSize: resolvedDefault } : {}),
            ...(resolvedMax !== undefined ? { maxSize: resolvedMax } : {}),
          },
        );
        const page = buildConnectionPage(rows as Record<string, unknown>[], pagination);
        if (totalCountAlias) {
          const spec = (parent as Record<string, unknown>)[relationName];
          if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
            (page as { totalCount?: number }).totalCount = (spec as Record<string, number>)[
              totalCountAlias
            ];
          }
        } else if (totalCountCallback && selectionIncludesField(info, 'totalCount')) {
          // Gated on selection: a rejecting callback shouldn't crash
          // queries that didn't ask for totalCount.
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
    const model = (this.contract as AnyContract).models[this.modelName as string];
    if (!model) {
      throw new PothosSchemaError(
        `Model '${this.modelName as string}' not found in contract.models.`,
      );
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

  // A to-one relation is nullable iff any FK local field is nullable.
  // Defaults to nullable when localFields aren't recorded (e.g. embed
  // relations) — safer than asserting non-null.
  #isToOneRelationNullable(meta: ContractRelation): boolean {
    const local = 'on' in meta ? meta.on.localFields : undefined;
    if (!local || local.length === 0) {
      return true;
    }
    const fields = (this.contract as AnyContract).models[this.modelName as string]?.fields;
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
