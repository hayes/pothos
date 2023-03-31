import type { GraphQLResolveInfo } from 'graphql';
import type { ArgumentRef } from '../refs/arg';
import type { InputFieldRef } from '../refs/input-field';
import type { InterfaceRef } from '../refs/interface';
import type { ObjectRef } from '../refs/object';
import type { SchemaTypes, VersionedSchemaBuilderOptions } from './schema-types';
import type {
  BaseEnum,
  EnumParam,
  FieldNullability,
  GenericFieldRef,
  GenericInputFieldRef,
  inputFieldShapeKey,
  InputRef,
  InterfaceParam,
  ObjectParam,
  ParentShape as GetParentShape,
  ShapeFromTypeParam,
  TypeParam,
} from './type-params';
import type {
  MaybePromise,
  Merge,
  Normalize,
  NormalizeNullableFields,
  RemoveNeverKeys,
} from './utils';

export type AddVersionedDefaultsToBuilderOptions<
  Types extends SchemaTypes,
  Version extends keyof VersionedSchemaBuilderOptions<SchemaTypes>,
> = PothosSchemaTypes.SchemaBuilderOptions<Types> extends infer Options
  ? VersionedSchemaBuilderOptions<Types>[Version] extends infer Defaults
    ? RemoveNeverKeys<Defaults & Omit<Options, keyof Defaults>>
    : never
  : never;

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
) => GenericFieldRef<unknown>;

export type InterfaceFieldThunk<Types extends SchemaTypes, Shape> = (
  t: PothosSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => GenericFieldRef<unknown>;

export type QueryFieldThunk<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.QueryFieldBuilder<Types, Types['Root']>,
) => GenericFieldRef<unknown>;

export type MutationFieldThunk<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.MutationFieldBuilder<Types, Types['Root']>,
) => GenericFieldRef<unknown>;

export type SubscriptionFieldThunk<Types extends SchemaTypes> = (
  t: PothosSchemaTypes.SubscriptionFieldBuilder<Types, Types['Root']>,
) => GenericFieldRef<unknown>;

export type FieldMap = Record<string, GenericFieldRef<unknown>>;

export type InputFieldMap = Record<string, GenericInputFieldRef<unknown>>;

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
    : Param extends ObjectRef<Types, unknown>
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
  ResolveType = unknown,
> = PothosSchemaTypes.InterfaceTypeOptions<Types, Shape, Interfaces, ResolveType> &
  (Param extends string
    ? {}
    : Param extends InterfaceRef<Types, unknown>
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
        values?: Partial<
          Record<keyof Param, Omit<PothosSchemaTypes.EnumValueConfig<Types>, 'value'>>
        >;
      }
    >
  : PothosSchemaTypes.EnumTypeOptions<Types, Values>;

export type ArgBuilder<Types extends SchemaTypes> = Omit<
  PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>,
  'field'
> &
  PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>['field'];

export type ValidateInterfaces<
  Shape,
  Types extends SchemaTypes,
  Interfaces extends InterfaceParam<Types>,
> = Interfaces extends InterfaceParam<Types>
  ? Shape extends GetParentShape<Types, Interfaces>
    ? Interfaces
    : 'Object shape must extend interface shape'
  : never;

export type InputShapeFromFields<Fields extends InputFieldMap> = NormalizeNullableFields<{
  [K in string & keyof Fields]: InputShapeFromField<Fields[K]>;
}>;

export type InputFieldsFromShape<
  Types extends SchemaTypes,
  Shape,
  Kind extends 'Arg' | 'InputObject',
> = {
  [K in keyof Shape]: Kind extends 'Arg'
    ? ArgumentRef<Types, Shape[K]>
    : Kind extends 'InputObject'
      ? InputFieldRef<Types, Shape[K]>
      : never;
};

export type InputShapeFromField<Field extends GenericInputFieldRef> = Field extends {
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
  [K in keyof ParentShape]-?: Awaited<ParentShape[K]> extends ShapeFromTypeParam<
    Types,
    Type,
    Nullable
  >
    ? K
    : never;
}[keyof ParentShape] &
  string;

export type ExposeNullability<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  ParentShape,
  Name extends keyof ParentShape,
  Nullable extends FieldNullability<Type>,
> = Awaited<ParentShape[Name]> extends ShapeFromTypeParam<Types, Type, Nullable>
  ? {
      nullable?: ExposeNullableOption<Types, Type, ParentShape, Name> & Nullable;
    }
  : {
      nullable: ExposeNullableOption<Types, Type, ParentShape, Name> & Nullable;
    };

export type ExposeNullableOption<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  ParentShape,
  Name extends keyof ParentShape,
> = FieldNullability<Type> &
  (Type extends [unknown]
    ? Awaited<ParentShape[Name]> extends readonly (infer T)[] | null | undefined
      ? [T] extends [NonNullable<T>]
        ? Awaited<ParentShape[Name]> extends NonNullable<Awaited<ParentShape[Name]>>
          ? boolean | { items: boolean; list: boolean }
          : true | { items: boolean; list: true }
        : Awaited<ParentShape[Name]> extends NonNullable<Awaited<ParentShape[Name]>>
          ? { items: true; list: boolean }
          : { items: true; list: true }
      : never
    : Awaited<ParentShape[Name]> extends NonNullable<Awaited<ParentShape[Name]>>
      ? boolean
      : true);
