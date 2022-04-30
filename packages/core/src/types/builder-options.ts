import { GraphQLResolveInfo } from 'graphql';
import FieldRef from '../refs/field';
import InputFieldRef from '../refs/input-field';
import InterfaceRef from '../refs/interface';
import ObjectRef from '../refs/object';
import { SchemaTypes } from './schema-types';
import {
  BaseEnum,
  EnumParam,
  FieldNullability,
  inputFieldShapeKey,
  InputRef,
  InterfaceParam,
  ObjectParam,
  ParentShape,
  ShapeFromTypeParam,
  TypeParam,
} from './type-params';
import { MaybePromise, Merge, Normalize, NormalizeNullableFields, RemoveNeverKeys } from './utils';

export type NormalizeSchemeBuilderOptions<Types extends SchemaTypes> = RemoveNeverKeys<
  PothosSchemaTypes.SchemaBuilderOptions<Types>
>;

export type Resolver<Parent, Args, Context, Type, Return = unknown> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => [Type] extends [readonly (infer Item)[] | null | undefined]
  ? ListResolveValue<Type, Item, Return>
  : MaybePromise<Type>;

export type ListResolveValue<Type, Item, Return> = Return extends AsyncGenerator<unknown, unknown>
  ? GeneratorResolver<Type, Item> & Return
  : null extends Type
  ? Return extends MaybePromise<readonly MaybePromise<Item>[] | null | undefined>
    ? Return
    : MaybePromise<readonly MaybePromise<Item>[]> | null | undefined
  : Return extends MaybePromise<readonly MaybePromise<Item>[]>
  ? Return
  : MaybePromise<readonly MaybePromise<Item>[]>;

export type GeneratorResolver<Type, Item> = null extends Type
  ? AsyncGenerator<Item | null | undefined, Item | null | undefined>
  : AsyncGenerator<Item, Item>;

export type Subscriber<Parent, Args, Context, Shape> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => MaybePromise<AsyncIterable<Shape>>;

export type EnumValues<Types extends SchemaTypes> = EnumValueConfigMap<Types> | readonly string[];

export type EnumValueConfigMap<Types extends SchemaTypes> = Record<
  string,
  PothosSchemaTypes.EnumValueConfig<Types>
>;

export type ShapeFromEnumValues<
  Types extends SchemaTypes,
  Values extends EnumValues<Types>,
> = Values extends readonly string[]
  ? Values[number]
  : Values extends EnumValueConfigMap<Types>
  ? {
      [K in keyof Values]: Values[K]['value'] extends number | string ? Values[K]['value'] : K;
    }[keyof Values]
  : never;

export type ObjectFieldsShape<Types extends SchemaTypes, Shape> = (
  t: PothosSchemaTypes.ObjectFieldBuilder<Types, Shape>,
) => FieldMap;

export type InterfaceFieldsShape<Types extends SchemaTypes, Shape> = (
  t: PothosSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => FieldMap;

export type QueryFieldsShape<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.QueryFieldBuilder<Types, Types['Root']>,
) => FieldMap;

export type MutationFieldsShape<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.MutationFieldBuilder<Types, Types['Root']>,
) => FieldMap;

export type SubscriptionFieldsShape<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.SubscriptionFieldBuilder<Types, Types['Root']>,
) => FieldMap;

export type ObjectFieldThunk<Types extends SchemaTypes, Shape> = (
  t: PothosSchemaTypes.ObjectFieldBuilder<Types, Shape>,
) => FieldRef<unknown>;

export type InterfaceFieldThunk<Types extends SchemaTypes, Shape> = (
  t: PothosSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => FieldRef<unknown>;

export type QueryFieldThunk<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.QueryFieldBuilder<Types, Types['Root']>,
) => FieldRef<unknown>;

export type MutationFieldThunk<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.MutationFieldBuilder<Types, Types['Root']>,
) => FieldRef<unknown>;

export type SubscriptionFieldThunk<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.SubscriptionFieldBuilder<Types, Types['Root']>,
) => FieldRef<unknown>;

export type FieldMap = Record<string, FieldRef>;

export type InputFieldMap<Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject'> = Record<
  string,
  InputFieldRef<unknown, Kind>
>;

export type FieldOptionsFromKind<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Kind extends FieldKind,
  ResolveShape,
  ResolveReturnShape,
> = PothosSchemaTypes.FieldOptionsByKind<
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
  Interfaces extends InterfaceParam<Types>[],
> = Normalize<
  (Param extends string
    ? {}
    : Param extends ObjectRef<unknown>
    ? { name?: string }
    : { name: string }) &
    (
      | PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
      | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>
    )
>;

export type InterfaceTypeOptions<
  Types extends SchemaTypes,
  Param extends InterfaceParam<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[],
> = PothosSchemaTypes.InterfaceTypeOptions<Types, Shape, Interfaces> &
  (Param extends string
    ? {}
    : Param extends InterfaceRef<unknown>
    ? { name?: string }
    : { name: string });

export type EnumTypeOptions<
  Types extends SchemaTypes,
  Param extends EnumParam,
  Values extends EnumValues<Types>,
> = Param extends BaseEnum
  ? Merge<
      Omit<PothosSchemaTypes.EnumTypeOptions<Types, Values>, 'values'> & {
        name: string;
      }
    >
  : PothosSchemaTypes.EnumTypeOptions<Types, Values>;

export type ArgBuilder<Types extends SchemaTypes> = PothosSchemaTypes.InputFieldBuilder<
  Types,
  'Arg'
>['field'] &
  Omit<PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>, 'field'>;

export type ValidateInterfaces<
  Shape,
  Types extends SchemaTypes,
  Interfaces extends InterfaceParam<Types>,
> = Interfaces extends InterfaceParam<Types>
  ? Shape extends ParentShape<Types, Interfaces>
    ? Interfaces
    : 'Object shape must extends interface shape'
  : never;

export type InputShapeFromFields<Fields extends InputFieldMap> = NormalizeNullableFields<{
  [K in string & keyof Fields]: InputShapeFromField<Fields[K]>;
}>;

export type InputFieldsFromShape<Shape extends object> = {
  [K in keyof Shape]: InputFieldRef<Shape[K], 'InputObject'>;
};

export type InputShapeFromField<Field extends InputFieldRef> = Field extends {
  [inputFieldShapeKey]: infer T;
}
  ? T
  : never;

export type FieldKind = keyof PothosSchemaTypes.FieldOptionsByKind<
  SchemaTypes,
  {},
  TypeParam<SchemaTypes>,
  boolean,
  {},
  {},
  {}
> &
  keyof PothosSchemaTypes.PothosKindToGraphQLType;

export type InputFieldKind = keyof PothosSchemaTypes.InputFieldOptionsByKind<
  SchemaTypes,
  InputRef<unknown>,
  boolean
>;

export type CompatibleTypes<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
> = {
  [K in keyof ParentShape]-?: ParentShape[K] extends ShapeFromTypeParam<Types, Type, Nullable>
    ? K
    : never;
}[keyof ParentShape];
