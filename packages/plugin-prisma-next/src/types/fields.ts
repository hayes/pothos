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
  ObjectRef,
  ObjectTypeOptions,
  OutputRefShape,
  OutputShape,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { prismaInterfaceBrand } from '../interface-ref.js';
import type { PrismaNextObjectRef, prismaContractBrand, prismaModelBrand } from '../object-ref.js';
import type { PrismaNextObjectFieldBuilder } from '../prisma-next-field-builder.js';
import type { ResolverCollection } from './collections.js';
import type { FieldParentShape, ModelKey, Row } from './models.js';
import type { RequiresNullable } from './relations.js';
import type {
  PrismaNextFieldSelect,
  ShapeFromSelect,
  TypeSelectObjectSpec,
  ValidateFieldSelect,
} from './selections.js';

/** `isNull` can resolve the field to null, so `nullable: false` can't accompany it. */
type VariantNullableOption<IsNull> = [IsNull] extends [never]
  ? boolean
  : true | RequiresNullable<'isNull can resolve the field to null'>;

/** Field options for `t.variant`, which are object field options without those it sets itself. */
export type PrismaNextVariantFieldOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  ParentShape,
  VariantRef extends PrismaNextObjectRef<Types, M, unknown>,
  Args extends InputFieldMap,
  Nullable extends boolean,
  // Inferred from what isNull returns, so its parameters are still contextually typed. never when
  // isNull is omitted.
  IsNull extends MaybePromise<boolean>,
  Selected extends keyof Row<Types, M> & string,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, ParentShape, VariantRef, Nullable, Args, unknown>,
  'type' | 'nullable' | 'select' | InferredFieldOptionKeys
> & {
  nullable?: Nullable & NoInfer<VariantNullableOption<IsNull>>;
  /** Columns to load for `isNull`, whatever the query selects, as an array or a `select` object. */
  select?: readonly Selected[] | { readonly [K in Selected]?: true };
  /** Resolves the field to null when this returns true, which makes the field nullable. */
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
  IsNull,
> = Row<Types, M> | (Nullable extends true ? null : [IsNull] extends [never] ? never : null);

export type PrismaNextObjectOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  ObjectTypeOptions<Types, ObjectRef<Types, Shape>, Shape, Interfaces>,
  'fields' | 'isTypeOf'
> &
  PrismaNextTypeOptions<Types, M, Shape> & {
    /** Receives the row as loaded for this type, with its key and the columns in `select`. */
    isTypeOf?: (
      row: Shape,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<boolean>;
  };

export type PrismaNextInterfaceOptions<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<InterfaceTypeOptions<Types, InterfaceRef<Types, Shape>, Shape, Interfaces>, 'fields'> &
  PrismaNextTypeOptions<Types, M, Shape>;

/**
 * The field options a `prismaNode`'s `id` takes beside its own, such as `description` or the
 * options other plugins add.
 */
export type NodeIdFieldOptions<Types extends SchemaTypes, Shape> = Omit<
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

/** `variant` names a type that shares its model with other types. Set at most one of them. */
export type NameOrVariant = { name?: never; variant?: string } | { name?: string; variant?: never };

type PrismaNextTypeOptions<Types extends SchemaTypes, M extends ModelKey<Types>, Shape> = {
  /** Columns and relations to always load for this type, as a column array or a `select` object. */
  select?: readonly (keyof Row<Types, M> & string)[] | TypeSelectObjectSpec<Types, M>;
  fields?: (
    // Passed explicitly because some editors leave the default unresolved, and `t.expose*` then
    // demands `nullable: true` on every column.
    t: PrismaNextObjectFieldBuilder<Types, M, FieldParentShape<Types, M, Shape>, Row<Types, M>>,
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
  : Kind extends 'PrismaNextObject'
    ? ShapeFromSelect<Types, ParentShape, ResolveShape>
    : ParentShape;

export type PrismaNextRootFieldOptions<
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
  resolve: (
    parent: RootResolveParent<Types, ParentShape, ResolveShape, Kind>,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<
    | ResolverCollection<Types, NoInfer<M>>
    | Extract<ShapeFromTypeParam<Types, Type, Nullable>, null | undefined>
  >;
};

export type PrismaNextRootFieldWithInputOptions<
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
    resolve: (
      parent: RootResolveParent<Types, ParentShape, ResolveShape, Kind>,
      args: InputShapeFromFields<Args> & {
        [K in InputName]:
          | InputShapeFromFields<Fields>
          | (true extends ArgRequired ? never : null | undefined);
      },
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<
      | ResolverCollection<Types, NoInfer<M>>
      | Extract<ShapeFromTypeParam<Types, Type, Nullable>, null | undefined>
    >;
  };

export type PrismaNextObjectFieldOptions<
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
  ShapeWithSelection,
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
      PrismaNextFieldSelect<Types, ParentShape, InputShapeFromFields<Args>> &
      // `Select` isn't inferred from the check, because inferring into it walks every branch.
      NoInfer<ValidateFieldSelect<Types, ParentShape, Select>>;
  };

/**
 * Matches a model's object ref by the model key it declares. Checking a `type` against
 * `PrismaNextObjectRef<Types, ModelKey<Types>>` would build the ref class and its return shape
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
    ? [PrismaNextObjectRef<Types, ParamToModelKey<Types, Param>, Shape>]
    : PrismaNextObjectRef<Types, ParamToModelKey<Types, Param>, Shape>;

/** Names the requested type when no column fits it, where `never` says only "not assignable". */
interface NoExposableColumn<Type> {
  readonly 'No column of this model can be exposed as': Type;
}

/** The columns `t.expose*` accepts for a GraphQL type. */
export type ExposableColumn<
  Types extends SchemaTypes,
  Shape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
> = [CompatibleTypes<Types, Shape, Type, Nullable>] extends [never]
  ? NoExposableColumn<Type>
  : CompatibleTypes<Types, Shape, Type, Nullable>;

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
  | ModelRefBrand<ModelKey<Types>, Types['PrismaNextContract']>;

/** A root field's `type`: a model's type, or a list of it. */
export type FieldParam<Types extends SchemaTypes> =
  | ModelKey<Types>
  | [ModelKey<Types>]
  | ModelRefBrand<ModelKey<Types>, Types['PrismaNextContract']>
  | [ModelRefBrand<ModelKey<Types>, Types['PrismaNextContract']>];
