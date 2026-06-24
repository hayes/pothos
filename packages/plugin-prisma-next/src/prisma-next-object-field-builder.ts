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
import type { PrismaNextObjectRef } from './object-ref';
import type {
  AnyContract,
  CursorSpec,
  DefaultRelationNullable,
  ModelName,
  PrismaNextRelatedConnectionOptions,
  PrismaNextRelationAggregateOptions,
  PrismaNextRelationCountOptions,
  PrismaNextRelationOptions,
  RelatedModel,
  RelationKeys,
  Row,
  ToManyRelationKeys,
} from './types';
import {
  applySelectionToCollection,
  type IndirectInclude,
  type MapperCollection,
} from './utils/apply-selection';
import { rebrandForVariant } from './utils/branding';
import { compileWhere } from './utils/compile-query';
import { resolveContractModel } from './utils/contract';
import { applyCursorPagination, buildConnectionPage, buildPaginationParams } from './utils/cursors';
import { readPluginOptions, resolveSizeOption } from './utils/options';
import { getRefFromContractModel } from './utils/refs';
import { selectionIncludesField, selectionSetIncludesField } from './utils/selection-walk';
import { wrapConnectionOptionsWithTotalCount } from './utils/total-count';

function isToManyCardinality(cardinality: string): boolean {
  return cardinality !== '1:1' && cardinality !== 'N:1';
}

/** No declarative refine fields present — the sugar's `query` was an empty literal. */
function isEmptyDeclarative(v: unknown): boolean {
  if (v == null || typeof v !== 'object') {
    return true;
  }
  const o = v as Record<string, unknown>;
  return (
    o.where === undefined && o.orderBy === undefined && o.take === undefined && o.skip === undefined
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
    // `name` is a positional parameter (not folded into the trailing
    // `...args` tuple) so TS can infer `Name extends CompatibleTypes<…>`
    // from the call site — folding it in collapses the constraint and
    // any string passes. Matches plugin-prisma / plugin-drizzle.
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
      // Positional `name` so the `Name extends CompatibleTypes<…>`
      // constraint actually narrows at the call site — see comment on
      // `expose` above.
      name: Name,
      ...args: NormalizeArgs<
        [
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
      const [options = {} as never] = args;
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
      select?: readonly (keyof Row<Types, M> & string)[];
      isNull?: (
        parent: Row<Types, M>,
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
    // Compile the variant routing through `pothosIndirectInclude` —
    // the field-level extension the walker honors to descend into the
    // named type's selection set on the same row. `select` (forced
    // column reads) compiles to `pothosOptions.select` as a column-only
    // array. Both extensions live on the field config; the walker
    // applies the columns at the parent level and recurses through the
    // indirect include for the rest of the selection.
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
      // Pass through as a column-array `select` — the walker's
      // `pothosOptions.select` branch picks up plain string arrays as
      // parent-level column reads.
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
    const targetRef =
      opts.type ?? (getRefFromContractModel(meta.to.model as never, this.builder) as never);
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
    // Compile to the select-option machinery. `query` is the legacy
    // sugar shape — passes through as the declarative refine entry,
    // which keeps the single-consumer fast path (no combine wrap when
    // only this field touches the relation).
    //   - no query: `{ [name]: true }`
    //   - literal query: `{ [name]: <literal> }` (where/orderBy/take/skip)
    //   - callback query: outer-form `(args, ctx) => ({ [name]: literal })`
    //     so args resolve once at the field's GraphQL request.
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

  /**
   * Expose the row count of a to-many relation as an `Int` field.
   * Ecosystem-parity sugar with `@pothos/plugin-prisma`'s
   * `t.relationCount`. Compiles to a function-form `select` that emits
   * `sub.count()` into the parent's combine spec — the same primitive
   * `t.field({ select: { rel: (sub) => ({ k: sub.count() }) } })` uses,
   * so the SQL path and the `where` refine are identical.
   *
   * Result is non-nullable `number` (a count over an empty set is 0).
   */
  relationCount<
    RelName extends RelationKeys<Types, M>,
    Nullable extends boolean = false,
    Args extends InputFieldMap = {},
  >(
    name: RelName,
    options?: PrismaNextRelationCountOptions<Types, M, RelName, Nullable, Args>,
  ): FieldRef<Types, number, 'PrismaNextObject'> {
    // `#aggregateField`'s return is the widened `number | null` (it
    // serves the aggregate ops too); a count is always non-null, so the
    // public method narrows the ref type back to `number`.
    return this.#aggregateField(name as string, 'count', undefined, options ?? {}, false) as never;
  }

  /**
   * Expose an aggregate (`sum`/`avg`/`min`/`max`/`count`) of a to-many
   * relation as a numeric field. Generalizes `t.relationCount`; the
   * `op` option selects the reducer and `field` names the numeric
   * column for `sum`/`avg`/`min`/`max` (omitted for `count`).
   *
   * Compiles to a function-form `select` emitting the matching
   * orm-client scalar reducer (`sub.sum('views')`, …) into the parent
   * combine spec. `count` resolves to `number`; the others resolve to
   * `number | null` (SQL aggregates over an empty set return NULL), so
   * those fields are exposed nullable by default.
   */
  relationAggregate<
    RelName extends RelationKeys<Types, M>,
    Op extends 'count' | 'sum' | 'avg' | 'min' | 'max',
    Nullable extends boolean = Op extends 'count' ? false : true,
    Args extends InputFieldMap = {},
  >(
    name: RelName,
    options: PrismaNextRelationAggregateOptions<Types, M, RelName, Op, Nullable, Args>,
  ): FieldRef<Types, Op extends 'count' ? number : number | null, 'PrismaNextObject'> {
    const { op, field, ...rest } = options as typeof options & {
      op: 'count' | 'sum' | 'avg' | 'min' | 'max';
      field?: string;
    };
    return this.#aggregateField(name as string, op, field, rest, op !== 'count') as never;
  }

  /**
   * Shared compiler for `relationCount` / `relationAggregate`. Builds a
   * function-form `select` keyed on the relation that runs the user's
   * `where` refine (literal or accessor-callback, args/ctx in scope)
   * then the chosen scalar reducer, and a resolver that reads the
   * lifted value off the parent. The combine key on the parent is the
   * relation name (the walker namespaces it under the field alias), so
   * the resolver reads `parent[name]`.
   */
  #aggregateField(
    name: string,
    op: 'count' | 'sum' | 'avg' | 'min' | 'max',
    field: string | undefined,
    options: Record<string, unknown>,
    nullableDefault: boolean,
  ): FieldRef<Types, number | null, 'PrismaNextObject'> {
    const { where, nullable, ...rest } = options as {
      where?: unknown;
      nullable?: boolean;
    } & Record<string, unknown>;
    const reduce = (rel: MapperCollection): unknown =>
      op === 'count' ? rel.count() : rel[op](field as string);
    const select = (args: unknown, ctx: unknown) => ({
      [name]: (sub: MapperCollection) => {
        if (where === undefined) {
          return { [name]: reduce(sub) };
        }
        const refined =
          typeof where === 'function'
            ? (sub.where((accessor: unknown) =>
                (where as (a: unknown, args: unknown, c: unknown) => unknown)(accessor, args, ctx),
              ) as MapperCollection)
            : (sub.where(where) as MapperCollection);
        return { [name]: reduce(refined) };
      },
    });
    const fieldOpts = {
      ...rest,
      type: op === 'avg' ? 'Float' : 'Int',
      nullable: nullable ?? nullableDefault,
      select,
      resolve: (parent: unknown) => (parent as Record<string, unknown>)[name],
    };
    return this.field(fieldOpts as never) as FieldRef<Types, number | null, 'PrismaNextObject'>;
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
    const targetRef =
      options.type ?? getRefFromContractModel(meta.to.model as never, this.builder as never);

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
      totalCount: _totalCount,
      extensions: userExtensions,
      ...rest
    } = options as typeof options & { where?: unknown };
    const pluginOpts = readPluginOptions(this.builder);
    const fallbackDefault = pluginOpts?.defaultConnectionSize;
    const fallbackMax = pluginOpts?.maxConnectionSize;
    const contract = this.contract as AnyContract;
    const cursorOpt = options.cursor;
    const relatedTypeName = meta.to.model;

    // Field-level pothosIndirectInclude — declares how the connection
    // wraps related rows so the plugin-errors interop sees the same
    // descent paths every other indirect-include uses. The walker
    // doesn't auto-descend through this for the column load (that's
    // handled inside the function-form select callback below where we
    // have access to `info` and the connection field's selection
    // node); the metadata is here for downstream plugins and future
    // walker simplifications.
    const pothosIndirectInclude: IndirectInclude = {
      getType: () => relatedTypeName,
      paths: [[{ name: 'edges' }, { name: 'node' }], [{ name: 'nodes' }]],
    };

    // Function-form `select` returning `{ [relationName]: fn }`. The
    // inner function receives (sub, fnArgs, fnCtx) and returns the
    // combine-spec entries that the walker namespaces under
    // `<fieldAlias>:<innerKey>`. The per-field overlay then surfaces
    // `parent.rows` and (when present) `parent.count` to the
    // connection field's resolver.
    //
    // The outer callback also receives `info` and the connection
    // field's selection node (internal extension to the signature) so
    // we can gate the synthetic `count` entry on whether the client
    // selected `totalCount` — emitting it unconditionally would force
    // an extra COUNT(*) per page on every query.
    const buildSelect = (
      _args: unknown,
      _ctx: unknown,
      info: GraphQLResolveInfo,
      fieldSelection: import('graphql').FieldNode,
      connectionReturnType: import('graphql').GraphQLNamedType,
    ) => {
      const wantsTotalCount =
        totalCountFlag &&
        selectionSetIncludesField(fieldSelection.selectionSet, 'totalCount', info);
      return {
        [relationName]: (sub: unknown, fnArgs: unknown, fnCtx: unknown) => {
          // 1) Apply user's `where` refine on the raw relation. The
          //    filter must come BEFORE cursor pagination so cursor
          //    over-fetch (`take(N+1)`) runs on the matching set.
          const filtered =
            refine != null
              ? (refine(sub, fnArgs, fnCtx) as MapperCollection)
              : (sub as MapperCollection);
          // 2) Resolve size options once per call.
          const resolvedDefault = resolveSizeOption(defaultSize, fnArgs, fnCtx) ?? fallbackDefault;
          const resolvedMax = resolveSizeOption(maxSize, fnArgs, fnCtx) ?? fallbackMax;
          // 3) Apply cursor pagination.
          const pagination = applyCursorPagination(
            filtered,
            cursorOpt,
            fnArgs as import('@pothos/plugin-relay').DefaultConnectionArguments,
            {
              ...(resolvedDefault !== undefined ? { defaultSize: resolvedDefault } : {}),
              ...(resolvedMax !== undefined ? { maxSize: resolvedMax } : {}),
            },
          );
          // 4) Descend into edges.node / nodes selections to pull the
          //    relevant columns into the paginated collection. The
          //    cursor cols are always loaded so buildConnectionPage
          //    can encode each row's cursor.
          const cursorCols: readonly string[] =
            typeof cursorOpt === 'string' ? [cursorOpt] : cursorOpt;
          const paginatedWithCols = applySelectionToCollection(
            pagination.collection,
            info,
            contract,
            fnCtx,
            {
              paths: [['edges', 'node'], ['nodes']],
              extraColumns: cursorCols,
              fieldNode: fieldSelection,
              startType: connectionReturnType,
              ...(pluginOpts?.skipDeferredFragments !== undefined
                ? { skipDeferredFragments: pluginOpts.skipDeferredFragments }
                : {}),
            },
          );
          // 5) Build the spec. Synthetic count fires only when the
          //    client selected totalCount AND user opted in via
          //    `totalCount: true`. Callable totalCount stays in the
          //    resolver — no extra DB round-trip in the spec.
          return wantsTotalCount
            ? { rows: paginatedWithCols, count: filtered.count() }
            : { rows: paginatedWithCols };
        },
      };
    };

    const connectionConfig = {
      ...rest,
      type: targetRef,
      select: buildSelect,
      extensions: { ...userExtensions, pothosIndirectInclude },
      resolve: async (
        parent: unknown,
        args: unknown,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => {
        // The per-field overlay surfaces `<alias>:rows` (and
        // `<alias>:count` when present) onto `parent` as `rows` /
        // `count`. Read those directly — no relation key lookups.
        const p = parent as { rows?: unknown; count?: unknown };
        const rows = p.rows;
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
          if (p.count !== undefined) {
            (page as { totalCount?: number }).totalCount = p.count as number;
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

  // A to-one relation is nullable iff any FK local field is nullable.
  // Defaults to nullable when localFields aren't recorded (e.g. embed
  // relations) — safer than asserting non-null.
  #isToOneRelationNullable(meta: ContractRelation): boolean {
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
