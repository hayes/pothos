import { GraphQLResolveInfo } from 'graphql';
import { Merge, RemoveNeverKeys } from './utils';

import {
  BaseEnum,
  EnumParam,
  FieldNullability,
  FieldRef,
  InputFieldRef,
  inputFieldShapeKey,
  InputRef,
  InterfaceParam,
  InterfaceRef,
  MaybePromise,
  MaybePromiseWithInference,
  NormalizeNullableFields,
  ObjectParam,
  ObjectRef,
  OutputShape,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '..';

export type NormalizeSchemeBuilderOptions<Types extends SchemaTypes> = RemoveNeverKeys<
  GiraphQLSchemaTypes.SchemaBuilderOptions<Types>
>;

export type Resolver<Parent, Args, Context, Type, Return = unknown> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => MaybePromiseWithInference<
  Type extends unknown[]
    ? Readonly<
        Return extends MaybePromise<readonly Promise<unknown>[]> ? Promise<Type[number]>[] : Type
      >
    : Type,
  Return
> &
  Return;

export type Subscriber<Parent, Args, Context, Shape> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => AsyncIterable<Shape>;

export type EnumValues<Types extends SchemaTypes> = EnumValueConfigMap<Types> | readonly string[];

export type EnumValueConfigMap<Types extends SchemaTypes> = Record<
  string,
  GiraphQLSchemaTypes.EnumValueConfig<Types>
>;

export type ShapeFromEnumValues<
  Types extends SchemaTypes,
  Values extends EnumValues<Types>
> = Values extends readonly string[]
  ? Values[number]
  : Values extends EnumValueConfigMap<Types>
  ? {
      [K in keyof Values]: Values[K]['value'] extends number | string ? Values[K]['value'] : K;
    }[keyof Values]
  : never;

export type ObjectFieldsShape<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.ObjectFieldBuilder<Types, Shape>,
) => FieldMap;

export type InterfaceFieldsShape<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => FieldMap;

export type QueryFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.QueryFieldBuilder<Types, Types['Root']>,
) => FieldMap;

export type MutationFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.MutationFieldBuilder<Types, Types['Root']>,
) => FieldMap;

export type SubscriptionFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, Types['Root']>,
) => FieldMap;

export type ObjectFieldThunk<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.ObjectFieldBuilder<Types, Shape>,
) => FieldRef<unknown>;

export type InterfaceFieldThunk<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => FieldRef<unknown>;

export type QueryFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.QueryFieldBuilder<Types, Types['Root']>,
) => FieldRef<unknown>;

export type MutationFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.MutationFieldBuilder<Types, Types['Root']>,
) => FieldRef<unknown>;

export type SubscriptionFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, Types['Root']>,
) => FieldRef<unknown>;

export interface FieldMap {
  [s: string]: FieldRef;
}

export interface InputFieldMap {
  [s: string]: InputFieldRef;
}

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
  Param extends ObjectParam<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[]
> = (Param extends string
  ? {}
  : Param extends ObjectRef<unknown>
  ? { name?: string }
  : { name: string }) &
  (
    | GiraphQLSchemaTypes.ObjectTypeOptions<Types, Shape>
    | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>
  );

export type InterfaceTypeOptions<
  Types extends SchemaTypes,
  Param extends InterfaceParam<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[]
> = GiraphQLSchemaTypes.InterfaceTypeOptions<Types, Shape, Interfaces> &
  (Param extends string
    ? {}
    : Param extends InterfaceRef<unknown>
    ? { name?: string }
    : { name: string });

export type EnumTypeOptions<
  Types extends SchemaTypes,
  Param extends EnumParam,
  Values extends EnumValues<Types>
> = Param extends BaseEnum
  ? Merge<
      Omit<GiraphQLSchemaTypes.EnumTypeOptions<Types, Values>, 'values'> & {
        name: string;
      }
    >
  : GiraphQLSchemaTypes.EnumTypeOptions<Types, Values>;

export type ArgBuilder<Types extends SchemaTypes> = GiraphQLSchemaTypes.InputFieldBuilder<
  Types,
  'Arg'
>['field'] &
  Omit<GiraphQLSchemaTypes.InputFieldBuilder<Types, 'Arg'>, 'field'>;

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
    [K in string & keyof Fields]: InputShapeFromField<Fields[K]>;
  }
>;

export type InputFieldsFromShape<Shape extends object> = {
  [K in keyof Shape]: InputFieldRef<Shape[K]>;
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
> &
  keyof GiraphQLSchemaTypes.GiraphQLKindToGraphQLType;

export type InputFieldKind = keyof GiraphQLSchemaTypes.InputFieldOptionsByKind<
  SchemaTypes,
  InputRef<unknown>,
  boolean
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
