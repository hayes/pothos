/* eslint-disable @typescript-eslint/no-redeclare */
import './types/global';
import BuildCache from './build-cache';
import SchemaBuilderClass from './builder';
import InternalFieldBuilder from './fieldUtils/builder';
import InternalInputFieldBuilder from './fieldUtils/input';
import InternalInterfaceFieldBuilder from './fieldUtils/interface';
import InternalMutationFieldBuilder from './fieldUtils/mutation';
import InternalObjectFieldBuilder from './fieldUtils/object';
import InternalQueryFieldBuilder from './fieldUtils/query';
import InternalRootFieldBuilder from './fieldUtils/root';
import InternalSubscriptionFieldBuilder from './fieldUtils/subscription';
import InternalBaseTypeRef from './refs/base';
import BuiltinScalarRef from './refs/builtin-scalar';
import InternalEnumRef from './refs/enum';
import FieldRef from './refs/field';
import InputTypeRef from './refs/input';
import InputFieldRef from './refs/input-field';
import InternalInputObjectRef, { ImplementableInputObjectRef } from './refs/input-object';
import InternalInterfaceRef, { ImplementableInterfaceRef } from './refs/interface';
import InternalObjectRef, { ImplementableObjectRef } from './refs/object';
import OutputTypeRef from './refs/output';
import InternalScalarRef from './refs/scalar';
import InternalUnionRef from './refs/union';
import { FieldKind, NormalizeSchemeBuilderOptions, SchemaTypes } from './types';

export * from './plugins';
export * from './types';
export * from './utils';

export {
  BuildCache,
  BuiltinScalarRef,
  FieldRef,
  ImplementableInputObjectRef,
  ImplementableInterfaceRef,
  ImplementableObjectRef,
  InputFieldRef,
  InputTypeRef,
  OutputTypeRef,
};

const SchemaBuilder = SchemaBuilderClass as unknown as {
  registerPlugin: typeof SchemaBuilderClass.registerPlugin;
  allowPluginReRegistration: boolean;

  new <Types extends Partial<GiraphQLSchemaTypes.UserSchemaTypes> = {}>(
    options: NormalizeSchemeBuilderOptions<GiraphQLSchemaTypes.ExtendDefaultTypes<Types>>,
  ): GiraphQLSchemaTypes.SchemaBuilder<GiraphQLSchemaTypes.ExtendDefaultTypes<Types>>;
};

export default SchemaBuilder;

export type FieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends 'Interface' | 'Object' = 'Interface' | 'Object',
> = GiraphQLSchemaTypes.FieldBuilder<Types, ParentShape, Kind>;
export const FieldBuilder = InternalFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
  Kind extends 'Interface' | 'Object' = 'Interface' | 'Object',
>(
  name: string,
) => GiraphQLSchemaTypes.FieldBuilder<Types, ParentShape, Kind>;

export type RootFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind = FieldKind,
> = GiraphQLSchemaTypes.RootFieldBuilder<Types, ParentShape, Kind>;
export const RootFieldBuilder = InternalRootFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind = FieldKind,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
  kind: FieldKind,
  graphqlKind: GiraphQLSchemaTypes.GiraphQLKindToGraphQLType[FieldKind],
) => GiraphQLSchemaTypes.RootFieldBuilder<Types, ParentShape, Kind>;

export type QueryFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = GiraphQLSchemaTypes.QueryFieldBuilder<Types, ParentShape>;
export const QueryFieldBuilder = InternalQueryFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.QueryFieldBuilder<Types, ParentShape>;

export type MutationFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = GiraphQLSchemaTypes.MutationFieldBuilder<Types, ParentShape>;
export const MutationFieldBuilder = InternalMutationFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.MutationFieldBuilder<Types, ParentShape>;

export type SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;
export const SubscriptionFieldBuilder = InternalSubscriptionFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;

export type ObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = GiraphQLSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;
export const ObjectFieldBuilder = InternalObjectFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;

export type InterfaceFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;
export const InterfaceFieldBuilder = InternalInterfaceFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;

export type InputFieldBuilder<
  Types extends SchemaTypes,
  Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject',
> = GiraphQLSchemaTypes.InputFieldBuilder<Types, Kind>;
export const InputFieldBuilder = InternalInputFieldBuilder as new <
  Types extends SchemaTypes,
  Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject',
>(
  builder: SchemaBuilderClass<Types>,
  kind: Kind,
  typename: string,
) => GiraphQLSchemaTypes.InputFieldBuilder<Types, Kind>;

export type BaseTypeRef = GiraphQLSchemaTypes.BaseTypeRef;
export const BaseTypeRef = InternalBaseTypeRef as new (
  kind: 'Enum' | 'InputObject' | 'Interface' | 'Object' | 'Scalar' | 'Union',
  name: string,
) => GiraphQLSchemaTypes.BaseTypeRef;

export type EnumRef<T, P = T> = GiraphQLSchemaTypes.EnumRef<T, P>;
export const EnumRef = InternalEnumRef as new <T, P = T>(
  name: string,
) => GiraphQLSchemaTypes.EnumRef<T, P>;

export type InputObjectRef<T> = GiraphQLSchemaTypes.InputObjectRef<T>;
export const InputObjectRef = InternalInputObjectRef as new <T>(
  name: string,
) => GiraphQLSchemaTypes.InputObjectRef<T>;

export type InterfaceRef<T, P = T> = GiraphQLSchemaTypes.InterfaceRef<T, P>;
export const InterfaceRef = InternalInterfaceRef as new <T, P = T>(
  name: string,
) => GiraphQLSchemaTypes.InterfaceRef<T, P>;

export type ObjectRef<T, P = T> = GiraphQLSchemaTypes.ObjectRef<T, P>;
export const ObjectRef = InternalObjectRef as new <T, P = T>(
  name: string,
) => GiraphQLSchemaTypes.ObjectRef<T, P>;

export type ScalarRef<T, U, P = T> = GiraphQLSchemaTypes.ScalarRef<T, U, P>;
export const ScalarRef = InternalScalarRef as new <T, U, P = T>(
  name: string,
) => GiraphQLSchemaTypes.ScalarRef<T, U, P>;

export type UnionRef<T, P = T> = GiraphQLSchemaTypes.UnionRef<T, P>;
export const UnionRef = InternalUnionRef as new <T, P = T>(
  name: string,
) => GiraphQLSchemaTypes.UnionRef<T, P>;
