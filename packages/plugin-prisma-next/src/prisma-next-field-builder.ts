import {
  completeValue,
  type FieldKind,
  type FieldNullability,
  type FieldRef,
  type InferredFieldOptionKeys,
  type InputFieldMap,
  type InterfaceParam,
  type MaybePromise,
  type NormalizeArgs,
  type ObjectRef,
  type PluginName,
  RootFieldBuilder,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type TypeParam,
} from '@pothos/core';
import type { NestedSelection } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import { PRISMA_NEXT_FIELD_SELECTION, PRISMA_NEXT_RELATION_ROWS } from './constants.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type {
  CountedRelationName,
  PrismaNextRelationCountOptions,
  RelationCountQuery,
} from './types/aggregates.js';
import type {
  ConnectionResultShape,
  DefaultEdgesNullability,
  DefaultNodeNullability,
  PrismaNextRelatedConnectionOptions,
  RelatedConnectionQueryLiteral,
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
import { refSelection, relationArgs, relationLoad } from './utils/compile-select.js';
import { getPluginConfig, type PrismaNextConfig } from './utils/config.js';
import {
  type ConnectionSettingsOptions,
  connectionNodes,
  connectionPaging,
  countOf,
} from './utils/connections.js';
import { modelDiscriminator, variantForRelationType } from './utils/contract.js';
import { orderableProblem } from './utils/cursors.js';
import { checkReturned } from './utils/errors.js';
import {
  keyOf,
  type LoadKind,
  type LoadRef,
  ownRef,
  queryLoad,
  record,
  refOf,
} from './utils/loads.js';
import { getModel, type PrismaNextModel, sharedVariantRelationError } from './utils/model.js';
import { refFor } from './utils/refs.js';
import { readLoad } from './utils/rows.js';
import {
  COMPUTE,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
  type Refine,
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

// Variance annotations avoid measuring variance structurally over every model's row types.
// `Shape` stays unannotated: helpers typed with a wider shape rely on its measured variance.
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
      select?: readonly string[] | Record<string, true | undefined>;
      extensions?: Record<string, unknown>;
    };
    const forced = Array.isArray(variantSelect)
      ? variantSelect
      : Object.entries(variantSelect ?? {})
          .filter(([, value]) => value != null)
          .map(([column]) => column);
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
    Query extends RelationQuery<Types, M, RelName, Args, TypeModel> | undefined,
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
        type?: unknown;
        query?: unknown;
        onNull?:
          | 'error'
          | ((parent: object, args: object, ctx: object, info: GraphQLResolveInfo) => unknown);
        extensions?: Record<string, unknown>;
      }?,
    ];
    const { config, model, relation } = this.#relation(name as string);
    const targetRef = refFor(this.builder, opts.type ?? relation.targetModel);
    const variant = variantForRelationType(
      this.contract as AnyContract,
      `t.relation('${name as string}') on '${this.modelKey as string}'`,
      relation.targetModel,
      targetRef.modelKey,
    );
    // Rows narrowed to a variant are queried by its columns.
    const queryModel = variant === undefined ? relation.targetModel : targetRef.modelKey;
    const { type: _type, query, onNull, extensions, ...rest } = opts;
    const relationName = name as string;
    // A to-one relation loads whole, so a variant `type` narrows it when the field resolves.
    const discriminator =
      variant === undefined || relation.isToMany
        ? undefined
        : modelDiscriminator(this.contract as AnyContract, relation.targetModel)!.field;
    const loadVariant = discriminator === undefined ? variant : undefined;
    const select = relationSelect(
      config,
      model,
      { kind: 'rows', name: relationName, variant: loadVariant, queryModel, query },
      (ref, refine, nested) =>
        completeValue(
          nested({
            columns: discriminator === undefined ? null : [discriminator],
            args: relationArgs(relation, { refine, variant: loadVariant }),
          }),
          (rows) => refSelection(ref, rows).selection,
        ),
    );
    return this.field({
      ...rest,
      type: relation.isToMany ? [targetRef] : targetRef,
      extensions: {
        ...extensions,
        [PRISMA_NEXT_FIELD_SELECTION]: select,
        [PRISMA_NEXT_RELATION_ROWS]: { name: relationName, type: targetRef },
      },
      resolve: (parent: object, args: object, context: object, info: GraphQLResolveInfo) => {
        const rows = readLoad(parent, ownRef(info)!) as Record<string, unknown> | null | undefined;
        if (rows == null || (discriminator !== undefined && rows[discriminator] !== variant)) {
          return typeof onNull === 'function' ? onNull(parent, args, context, info) : null;
        }
        return rows;
      },
    } as never) as never;
  }

  /** Exposes the row count of a to-many relation as an `Int`. */
  relationCount<
    RelName extends ToManyRelationKeys<Types, M>,
    Query extends RelationCountQuery<Types, M, RelName, Args> | undefined,
    Args extends InputFieldMap = {},
  >(
    name: CountedRelationName<Types, RelName>,
    options?: PrismaNextRelationCountOptions<Types, M, RelName, Args, Shape, Query>,
  ): FieldRef<Types, number, 'PrismaNextObject'> {
    const relationName = name as string;
    const { config, model, relation } = this.#relation(relationName);
    const { query, extensions, ...rest } = (options ?? {}) as {
      query?: unknown;
      extensions?: Record<string, unknown>;
    } & Record<string, unknown>;
    // The types allow only `where`.
    const select = relationSelect(
      config,
      model,
      { kind: 'count', name: relationName, queryModel: relation.targetModel, query },
      (ref, refine) => ({
        computed: {
          [keyOf(ref)]: {
            kind: 'count' as const,
            [COMPUTE]: (sub) => countOf(refine ? refine(sub) : sub),
          },
        },
      }),
    );
    return this.field({
      ...rest,
      type: 'Int',
      nullable: false,
      extensions: {
        ...extensions,
        [PRISMA_NEXT_FIELD_SELECTION]: select,
      },
      resolve: (parent: object, _args: object, _context: object, info: GraphQLResolveInfo) =>
        readLoad(parent, ownRef(info)!),
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
        // The model of `type`. A variant of the target narrows the rows.
        TypeModel extends RelationTypeModel<Types, M, RelName> = RelatedModel<Types, M, RelName>,
        // The relation's target, as a parameter, which is cheaper to check than computing it.
        Target extends ModelKey<Types> = RelatedModel<Types, M, RelName>,
        QueryLiteral extends RelatedConnectionQueryLiteral<
          Types,
          Target,
          TypeModel
        > = RelatedConnectionQueryLiteral<Types, Target, TypeModel>,
        EdgeNullability extends FieldNullability<[unknown]> = DefaultEdgesNullability<Types>,
        NodeNullability extends boolean = DefaultNodeNullability<Types>,
      >(
        name: RelName,
        ...args: NormalizeArgs<
          [
            options: PrismaNextRelatedConnectionOptions<
              Types,
              M,
              RelName,
              Nullable,
              Args,
              RelatedShape,
              Shape,
              TypeModel,
              QueryLiteral,
              EdgeNullability,
              NodeNullability
            >,
            connectionOptions?:
              | PothosSchemaTypes.ConnectionObjectOptions<
                  Types,
                  PrismaNextObjectRef<Types, RelatedModel<Types, M, RelName>, RelatedShape>,
                  EdgeNullability,
                  NodeNullability,
                  ConnectionResultShape<Shape, Args>,
                  ConnectionInterfaces
                >
              | ObjectRef<Types, unknown>,
            edgeOptions?:
              | PothosSchemaTypes.ConnectionEdgeObjectOptions<
                  Types,
                  PrismaNextObjectRef<Types, RelatedModel<Types, M, RelName>, RelatedShape>,
                  NodeNullability,
                  ConnectionResultShape<Shape, Args>,
                  EdgeInterfaces
                >
              | ObjectRef<Types, unknown>,
          ],
          0
        >
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
      type?: unknown;
      extensions?: Record<string, unknown>;
      [key: string]: unknown;
    } = {},
    connectionOptions: object = {},
    edgeOptions: object = {},
  ) {
    const { config, model, relation } = this.#relation(name);
    const relatedModel = relation.targetModel;
    const targetRef = refFor(this.builder, options.type ?? relatedModel);
    const variant = variantForRelationType(
      config.contract,
      `t.relatedConnection('${name}') on '${this.modelKey as string}'`,
      relatedModel,
      targetRef.modelKey,
    );
    const { type: _type, defaultSize, maxSize, query, totalCount, extensions, ...rest } = options;
    // Rows narrowed to a variant are ordered and filtered by its columns.
    const paging = connectionPaging(
      config,
      variant === undefined ? relatedModel : targetRef.modelKey,
      { defaultSize, maxSize, totalCount, query },
    );
    const include = connectionNodes(targetRef.name);
    const select: PrismaNextSelectFn = (args, ctx, nested, selected, position) =>
      completeValue(
        paging.pageLoads(ctx, model, relation, name, args, selected(), {
          variant,
          filtered: config.filterConnectionTotalCount,
          rows: (seed) => completeValue(nested(seed, include), (selection) => ({ selection })),
        }),
        ({ selection, ref }) => {
          record(position, { refs: [ref], model, view: false });
          return selection;
        },
      );
    const connectionConfig = {
      ...rest,
      type: targetRef,
      extensions: {
        ...extensions,
        pothosIndirectInclude: include,
        [PRISMA_NEXT_FIELD_SELECTION]: select,
        [PRISMA_NEXT_RELATION_ROWS]: { name, type: targetRef },
      },
      resolve: paging.ownPage,
    };
    return (
      this as typeof this & {
        connection: (cfg: object, c?: object, e?: object) => FieldRef<SchemaTypes>;
      }
    ).connection(connectionConfig, paging.connectionOptions(connectionOptions), edgeOptions);
  } as never;

  /** Throws for a name several variants declare, which the types can't tell apart. */
  #relation(name: string) {
    const config = getPluginConfig(this.builder);
    const model = getModel(config.contract, this.modelKey as string);
    if (model.sharedVariantRelations.has(name)) {
      throw sharedVariantRelationError(`model '${this.modelKey as string}'`, name, model);
    }
    return { config, model, relation: model.relations[name]! };
  }
}

/**
 * A callback query builds its callbacks anew on every call, so the field's query and its
 * arguments identify the load.
 */
function relationSelect(
  config: PrismaNextConfig,
  model: PrismaNextModel,
  {
    kind,
    name,
    variant,
    queryModel,
    query,
  }: { kind: LoadKind; name: string; variant?: string; queryModel: string; query: unknown },
  selection: (
    ref: LoadRef,
    refine: Refine | undefined,
    nested: NestedSelection<PrismaNextSelection>,
  ) => MaybePromise<PrismaNextSelection>,
): PrismaNextSelectFn {
  const prepare = (value: unknown, problem?: Parameters<typeof relationLoad>[3]) => {
    const { query: loaded, refine } = relationLoad(config.contract, queryModel, value, problem);
    const load = (args: object) =>
      queryLoad(
        kind,
        name,
        variant,
        loaded,
        typeof query === 'function' ? () => ({ fn: query, args }) : undefined,
      );
    return { refine, load };
  };
  const literal =
    typeof query === 'function'
      ? undefined
      : prepare(query, orderableProblem(config.context, queryModel));
  const literalLoad = literal?.load({});
  return (args, ctx, nested, _selected, position) =>
    completeValue(
      typeof query === 'function'
        ? (query as (args: object, ctx: object) => unknown)(args, ctx)
        : query,
      (value) => {
        const prepared = literal ?? checkReturned(value, (returned) => prepare(returned));
        const ref = refOf(config, ctx, model, literalLoad ?? prepared.load(args));
        record(position, { refs: [ref], model, view: false });
        return selection(ref, prepared.refine, nested);
      },
    );
}
