import { GraphQLResolveInfo, GraphQLEnumValueConfigMap } from 'graphql';
import {
  MaybePromiseWithInference,
  MaybePromise,
  SchemaTypes,
  Field,
  InputField,
  TypeParam,
  FieldNullability,
  InterfaceParam,
  ShapeFromTypeParam,
  NormalizeNullableFields,
  OutputShape,
  InputFieldRef,
  FieldRef,
  inputFieldShapeKey,
} from '..';

export type Resolver<Parent, Args, Context, Type, Return = unknown> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => Return &
  MaybePromiseWithInference<
    Readonly<
      | Type
      | (Type extends unknown[]
          ? Return extends MaybePromise<Promise<unknown>[]>
            ? Promise<Type[number]>[]
            : never
          : never)
    >,
    Return
  >;

export type Subscriber<Parent, Args, Context, Shape> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => AsyncIterable<Shape>;

export type EnumValues = readonly string[] | GraphQLEnumValueConfigMap;

export type ShapeFromEnumValues<Values extends EnumValues> = Values extends readonly string[]
  ? Values[number]
  : Values extends GraphQLEnumValueConfigMap
  ? {
      [K in keyof Values]: Values[K]['value'] extends string | number ? Values[K]['value'] : K;
    }[keyof Values]
  : never;

export type ObjectFieldsShape<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.ObjectFieldBuilder<Types, Shape>,
) => {
  [s: string]: Field<unknown>;
};

export type InterfaceFieldsShape<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => {
  [s: string]: Field<unknown>;
};

export type QueryFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.QueryFieldBuilder<Types, Types['Root']>,
) => {
  [s: string]: Field<unknown>;
};

export type MutationFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.MutationFieldBuilder<Types, Types['Root']>,
) => {
  [s: string]: Field<unknown>;
};

export type SubscriptionFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, Types['Root']>,
) => {
  [s: string]: Field<unknown>;
};

export type ObjectFieldThunk<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.ObjectFieldBuilder<Types, Shape>,
) => Field<unknown>;

export type InterfaceFieldThunk<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => Field<unknown>;

export type QueryFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.QueryFieldBuilder<Types, Types['Root']>,
) => Field<unknown>;

export type MutationFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.MutationFieldBuilder<Types, Types['Root']>,
) => Field<unknown>;

export type SubscriptionFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, Types['Root']>,
) => Field<unknown>;

export type FieldMap = {
  [s: string]: FieldRef;
};

export type InputFieldMap = {
  [s: string]: InputFieldRef;
};

export type FieldOptionsFromKind<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Kind extends FieldKind,
  ResolveShape,
  ResolveReturnShape
> = GiraphQLSchemaTypes.FieldOptionsByKind<
  Types,
  ParentShape,
  Type,
  Nullable,
  Args,
  ResolveShape,
  ResolveReturnShape
>[Kind];

export type ObjectTypeOptions<
  Types extends SchemaTypes,
  Shape,
  Interfaces extends InterfaceParam<Types>[]
> =
  | GiraphQLSchemaTypes.ObjectTypeOptions<Types, Shape>
  | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>;

export type ArgBuilder<Types extends SchemaTypes> = GiraphQLSchemaTypes.InputFieldBuilder<
  Types
>['field'] &
  Omit<GiraphQLSchemaTypes.InputFieldBuilder<Types>, 'field'>;

export type ValidateInterfaces<
  Shape,
  Types extends SchemaTypes,
  Interfaces extends InterfaceParam<Types>
> = Interfaces extends InterfaceParam<Types>
  ? Shape extends OutputShape<Types, Interfaces>
    ? Interfaces
    : 'Object shape must extends interface shape'
  : never;

export type InputShapeFromFields<Fields extends InputFieldMap> = NormalizeNullableFields<
  {
    [K in keyof Fields]: InputShapeFromField<Fields[K]>;
  }
>;

export type InputFieldsFromShape<Shape extends object> = {
  [K in keyof Shape]: InputField<Shape[K]>;
};

export type InputShapeFromField<Field extends InputFieldRef> = Field extends {
  [inputFieldShapeKey]: infer T;
}
  ? T
  : never;

export type FieldKind = keyof GiraphQLSchemaTypes.FieldOptionsByKind<
  SchemaTypes,
  {},
  TypeParam<SchemaTypes>,
  boolean,
  {},
  {},
  {}
>;

export type CompatibleTypes<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>
> = {
  [K in keyof ParentShape]-?: ParentShape[K] extends ShapeFromTypeParam<Types, Type, Nullable>
    ? K
    : never;
}[keyof ParentShape];

export type Resolvers<Parent = unknown, Context = unknown> = {
  [s: string]:
    | Resolver<Parent, unknown, Context, unknown>
    | {
        resolve: Resolver<Parent, unknown, Context, unknown>;
        subscribe: Subscriber<Parent, unknown, Context, unknown>;
      };
};

export type ResolverMap = {
  [s: string]: Resolvers;
};
