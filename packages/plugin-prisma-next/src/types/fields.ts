import type {
  ArgumentRef,
  CheckAsyncSelection,
  CompatibleTypes,
  ExposeNullability,
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldOptionsFromKind,
  InferredFieldOptionKeys,
  InferredFieldOptionsByKind,
  InputFieldMap,
  InputShapeFromFields,
  InterfaceParam,
  InterfaceRef,
  InterfaceTypeOptions,
  MaybePromise,
  ObjectParam,
  ObjectRef,
  ObjectTypeOptions,
  OutputRefShape,
  OutputShape,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { AsyncIterableResult } from '@prisma/orm-framework/components/runtime';
import type { GraphQLInterfaceType, GraphQLResolveInfo } from 'graphql';
import type { prismaInterfaceBrand } from '../interface-ref.js';
import type { PrismaObjectRef, prismaContractBrand, prismaModelBrand } from '../object-ref.js';
import type { PrismaObjectFieldBuilder } from '../prisma-field-builder.js';
import type { PlannedCollection, ResolverCollection, TypeCollection } from './collections.js';
import type { FieldParentShape, IdFieldShape, ModelKey, ResolveTypeParent, Row } from './models.js';
import type { FieldQueryLiteral, QueryKeys, QueryOption } from './relations.js';
import type {
  InterfaceNestedRow,
  PrismaFieldSelectForm,
  SelectObjectSpec,
  ShapeFromSelect,
  TypeParamModel,
  TypeSelectCheck,
  ValidateFieldSelect,
} from './selections.js';

/** `isNull` can resolve the field to null, so it needs the field to be nullable. */
type VariantIsNullRequirement<Nullable extends boolean, IsNull> = [IsNull] extends [never]
  ? {}
  : [Nullable] extends [true]
    ? {}
    : { nullable: true };

/** Field options for `t.variant`, which are object field options without those it sets itself. */
export type PrismaVariantFieldOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  ParentShape,
  VariantRef extends PrismaObjectRef<Types, M, unknown>,
  Args extends InputFieldMap,
  Nullable extends boolean,
  // Inferred from what isNull returns, so its parameters are still contextually typed. never when
  // isNull is omitted.
  IsNull extends MaybePromise<boolean>,
  Selected extends keyof Row<Types, M> & string,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, ParentShape, VariantRef, Nullable, Args, unknown>,
  'type' | 'select' | InferredFieldOptionKeys
> &
  VariantIsNullRequirement<Nullable, IsNull> & {
    /** Columns to load for `isNull`, whatever the query selects, as an array or a `select` object. */
    select?: readonly Selected[] | { readonly [K in Selected]?: true };
    /** Resolves the field to null when this returns true. The field must be nullable. */
    isNull?: (
      parent: ParentShape & Pick<Row<Types, M>, Selected>,
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => IsNull;
  };

/** The row a variant field resolves to, which is its parent's, or null when it's nullable. */
export type VariantFieldShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Nullable extends boolean,
> = Row<Types, M> | (Nullable extends true ? null : never);

export type PrismaObjectOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  ObjectTypeOptions<Types, ObjectRef<Types, Shape>, Shape, Interfaces>,
  'fields' | 'isTypeOf'
> &
  PrismaTypeOptions<Types, M, Shape>;

export type PrismaInterfaceOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  InterfaceTypeOptions<Types, InterfaceRef<Types, Shape>, Shape, Interfaces>,
  'fields' | 'resolveType'
> &
  PrismaTypeOptions<Types, M, Shape> & {
    resolveType?: (
      // An annotated parameter is checked against the parent rather than inferred as `Shape`.
      parent: NoInfer<ResolveTypeParent<Types, M, Shape>>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
      type: GraphQLInterfaceType,
    ) => MaybePromise<ObjectParam<Types> | string | null | undefined>;
  };

/**
 * The field options a `prismaNode`'s `id` takes beside its own, such as `description` or the
 * options other plugins add.
 */
type NodeIdFieldOptions<Types extends SchemaTypes, Shape> = Omit<
  FieldOptionsFromKind<
    Types,
    Shape,
    'ID',
    false,
    {},
    'Object',
    OutputShape<Types, 'ID'>,
    MaybePromise<OutputShape<Types, 'ID'>>
  >,
  'args' | 'nullable' | 'type' | 'resolve' | InferredFieldOptionKeys
>;

/** The options `builder.prismaNode` takes. */
export type PrismaNodeOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Interfaces extends InterfaceParam<Types>[],
  Select,
  Shape,
  IDFields,
  IDShape,
> = Omit<PrismaObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
  select?: Select;
  id: NodeIdFieldOptions<Types, Shape & IdFieldShape<Types, M, IDFields>> & {
    /** A column, or a tuple of columns for a composite key. */
    field: IDFields;
  } & (
      | { parse?: undefined; resolve?: undefined }
      | {
          /**
           * Decodes the ID `resolve` encodes, returning the column's value, or a tuple of
           * values for a composite key. Set `parse` and `resolve` together.
           */
          parse: (id: string, ctx: Types['Context']) => IDShape;
          /** Encodes the ID, which `parse` decodes. Set `parse` and `resolve` together. */
          resolve: (
            parent: Shape & IdFieldShape<Types, M, IDFields>,
            ctx: Types['Context'],
          ) => MaybePromise<OutputShape<Types, 'ID'>>;
        }
    );
  /**
   * Returns the collection `node` and `nodes` lookups load from, which is used as given.
   * It defaults to the client's collection for the model, narrowed to the model's
   * variant, as with `orm.Base.variant(value)`.
   */
  collection?: (ctx: Types['Context']) => ResolverCollection<Types, NoInfer<M>>;
} & TypeSelectCheck<Types, M, Select> &
  NameOrVariant;

/** `variant` names a type that shares its model with other types. Set at most one of them. */
export type NameOrVariant = { name?: never; variant?: string } | { name?: string; variant?: never };

type PrismaTypeOptions<Types extends SchemaTypes, M extends ModelKey<Types>, Shape> = {
  /** Columns and relations to always load for this type, as a column array or a `select` object. */
  select?: readonly (keyof Row<Types, M> & string)[] | SelectObjectSpec<Types, M>;
  fields?: (
    // Passed explicitly because some editors leave the default unresolved, and `t.expose*` then
    // demands `nullable: true` on every column. `NoInfer`, because `M` is already known, and
    // inferring from the row would measure the variance of upstream's row types (~20 ms).
    t: PrismaObjectFieldBuilder<
      Types,
      M,
      FieldParentShape<Types, M, Shape>,
      NoInfer<Row<Types, M>>
    >,
  ) => FieldMap;
} & NameOrVariant;

/**
 * A subscription field resolves each value its `subscribe` yields, not the root. On a prisma type,
 * `ResolveShape` is the field's `select`, which adds to the parent.
 */
export type RootResolveParent<
  Types extends SchemaTypes,
  ParentShape,
  ResolveShape,
  Kind,
> = Kind extends 'Subscription'
  ? ResolveShape
  : Kind extends 'PrismaObject'
    ? ShapeFromSelect<Types, ParentShape, ResolveShape>
    : ParentShape;

export type PrismaRootFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Param,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  ResolveShape,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind,
  // A defaulted generic so `resolve` doesn't infer `Param` as the bare model and reject `[Model]`.
  M extends ModelKey<Types> = ParamToModelKey<Types, Param>,
  QueryLiteral = FieldQueryLiteral<Types, M>,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args,
    Kind,
    ResolveShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | InferredFieldOptionKeys
> & {
  type: Param;
} & PrismaRootFieldResolver<
    Types,
    RootResolveParent<Types, ParentShape, ResolveShape, Kind>,
    InputShapeFromFields<Args>,
    NoInfer<M>,
    ShapeFromTypeParam<Types, Type, Nullable>,
    [Param] extends [[unknown]] ? true : false,
    QueryLiteral
  >;

/**
 * A `prismaField` loads its rows from `collection`, which defaults to the type's, shaped by `query`,
 * or takes `resolve`, which gets the type's collection planned and returns what a read or write on
 * it returns. A single-row field sets at least one of them.
 */
type PrismaRootFieldResolver<
  Types extends SchemaTypes,
  Parent,
  ArgsShape,
  M extends ModelKey<Types>,
  Shape,
  IsList extends boolean,
  QueryLiteral,
> =
  | (RootFieldLoad<Types, Parent, ArgsShape, M, Shape, QueryLiteral> &
      ([IsList] extends [true]
        ? {}
        :
            | SingleRowFieldNeedsCollectionQueryOrResolve<'query'>
            | SingleRowFieldNeedsCollectionQueryOrResolve<'collection'>))
  | {
      /**
       * Gets `orm.<Model>`, or `orm.<Base>.variant(value)` for a variant, with the field's
       * selection planned, and returns the rows its reads or writes return.
       */
      resolve: (
        collection: PlannedCollection<TypeCollection<Types, M>>,
        parent: Parent,
        args: ArgsShape,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) =>
        | MaybePromise<NoInfer<Shape>>
        | NoInfer<PlannedListResult<Shape>>
        | PromiseLike<NoInfer<Shape>>;
      collection?: never;
      query?: never;
    };

/** The options a `prismaField` loads its rows with, beside `resolve`. */
type RootFieldLoad<
  Types extends SchemaTypes,
  Parent,
  ArgsShape,
  M extends ModelKey<Types>,
  Shape,
  QueryLiteral,
> = {
  /**
   * Returns the collection to load from, without `include()`: the plugin loads what the query
   * selects. It defaults to `orm.<Model>`, or `orm.<Base>.variant(value)` for a variant.
   */
  collection?: (
    parent: Parent,
    args: ArgsShape,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<ResolverCollection<Types, M> | Extract<Shape, null | undefined>>;
  /** Filters, orders and pages the collection. */
  query?: QueryOption<Types, M, ArgsShape, QueryLiteral, QueryKeys>;
  resolve?: ResolveExcludesCollectionAndQuery;
};

/** Names why `resolve` is rejected beside `collection` or `query`, where `never` says "undefined". */
interface ResolveExcludesCollectionAndQuery {
  readonly "resolve gets the type's collection, so it excludes collection and query": true;
}

/**
 * Requires `collection` or `query` of a single-row field without `resolve`, named for the error a
 * field without any of them gets.
 */
type SingleRowFieldNeedsCollectionQueryOrResolve<Option extends 'collection' | 'query'> = {
  [K in Option]: {};
};

/** A list field's `all()` result, compared by its rows so a wrong row is reported directly. */
type PlannedListResult<Shape> = Shape extends readonly (infer Item)[]
  ? AsyncIterableResult<Item>
  : never;

export type PrismaRootFieldWithInputOptions<
  Types extends SchemaTypes,
  ParentShape,
  Param,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Fields extends InputFieldMap,
  InputName extends string,
  ResolveShape,
  ResolveReturnShape,
  ArgRequired extends boolean,
  Kind extends FieldKind = FieldKind,
  M extends ModelKey<Types> = ParamToModelKey<Types, Param>,
  QueryLiteral = FieldQueryLiteral<Types, M>,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args & {
      [K in InputName]: ArgumentRef<
        Types,
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    },
    Kind,
    ResolveShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | 'args' | InferredFieldOptionKeys
> &
  PothosSchemaTypes.FieldWithInputBaseOptions<Types, Args, Fields, InputName, ArgRequired> & {
    type: Param;
  } & PrismaRootFieldResolver<
    Types,
    RootResolveParent<Types, ParentShape, ResolveShape, Kind>,
    InputShapeFromFields<Args> & {
      [K in InputName]:
        | InputShapeFromFields<Fields>
        | (true extends ArgRequired ? never : null | undefined);
    },
    NoInfer<M>,
    ShapeFromTypeParam<Types, Type, Nullable>,
    [Param] extends [[unknown]] ? true : false,
    QueryLiteral
  >;

/**
 * A field's `select` adds to the parent only its `resolve` sees. Other options, such as scope-auth's
 * `authScopes`, run before the field's `select` loads, so they see the type's shape: its key and
 * what the `select`s of the type and its interfaces load.
 */
export type PrismaObjectFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Select,
  ResolveReturnShape,
  ShapeWithSelection = ShapeFromSelect<Types, ParentShape, Select>,
> = PothosSchemaTypes.ObjectFieldOptions<
  Types,
  ParentShape,
  Type,
  Nullable,
  Args,
  ResolveReturnShape
> &
  InferredFieldOptionsByKind<
    Types,
    Types['InferredFieldOptionsKind'],
    ShapeWithSelection,
    Type,
    Nullable,
    Args,
    ResolveReturnShape
  > & {
    select?: Select &
      CheckAsyncSelection<Types, Select> &
      PrismaFieldSelectForm<
        Types,
        ParentShape,
        InputShapeFromFields<Args>,
        TypeParamModel<Types, Type>,
        InterfaceNestedRow<Types, Type>,
        Select
      > &
      // `Select` isn't inferred from the check, because inferring into it walks every branch.
      NoInfer<ValidateFieldSelect<Types, ParentShape, Select>>;
  };

/**
 * Matches a model's object ref by the model key it declares. Checking a `type` against
 * `PrismaObjectRef<Types, ModelKey<Types>>` would build the ref class and its return shape
 * over every model in the contract. The contract brand rejects a ref from a builder of another
 * contract.
 */
interface ModelObjectRefBrand<M, C = unknown> extends OutputRefShape<unknown> {
  readonly [prismaModelBrand]: M;
  readonly [prismaContractBrand]: C;
  readonly modelKey: M;
}

/** The interface counterpart of {@link ModelObjectRefBrand}. */
interface ModelInterfaceRefBrand<M, C = unknown> extends OutputRefShape<unknown> {
  readonly [prismaInterfaceBrand]: M;
  readonly [prismaContractBrand]: C;
  readonly modelKey: M;
}

/** A model's object or interface ref, matched by its brands. */
type ModelRefBrand<M, C = unknown> = ModelObjectRefBrand<M, C> | ModelInterfaceRefBrand<M, C>;

export type ParamToModelKey<Types extends SchemaTypes, Param> =
  Param extends ModelKey<Types>
    ? Param
    : Param extends [infer M extends ModelKey<Types>]
      ? M
      : Param extends ModelRefBrand<infer M extends ModelKey<Types>>
        ? M
        : Param extends [ModelRefBrand<infer M extends ModelKey<Types>>]
          ? M
          : never;

export type ParamToTypeParam<Types extends SchemaTypes, Param, Shape> = Param extends
  | ModelRefBrand<string>
  | [ModelRefBrand<string>]
  ? Param
  : Param extends [unknown]
    ? [PrismaObjectRef<Types, ParamToModelKey<Types, Param>, Shape>]
    : PrismaObjectRef<Types, ParamToModelKey<Types, Param>, Shape>;

/** The columns `t.expose*` accepts for a GraphQL type. */
export type ExposableColumn<
  Types extends SchemaTypes,
  Shape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
> = CompatibleTypes<Types, Shape, Type, Nullable>;

/** The `nullable` option `t.expose*` requires, or none while the column is rejected. */
export type ExposeColumnNullability<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  Shape,
  Name,
  Nullable extends FieldNullability<Type>,
> = Name extends keyof Shape ? ExposeNullability<Types, Type, Shape, Name, Nullable> : {};

/** What a model's root field or connection may name as its `type`. */
export type ModelParam<Types extends SchemaTypes> =
  | ModelKey<Types>
  | ModelRefBrand<ModelKey<Types>, Types['PrismaContract']>;

/** A root field's `type`: a model's type, or a list of it. */
export type FieldParam<Types extends SchemaTypes> =
  | ModelKey<Types>
  | [ModelKey<Types>]
  | ModelRefBrand<ModelKey<Types>, Types['PrismaContract']>
  | [ModelRefBrand<ModelKey<Types>, Types['PrismaContract']>];
