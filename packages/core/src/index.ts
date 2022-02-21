/* eslint-disable @typescript-eslint/no-redeclare */
import './types/global';
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
import InternalEnumRef from './refs/enum';
import InternalInputObjectRef from './refs/input-object';
import InternalInterfaceRef from './refs/interface';
import InternalObjectRef from './refs/object';
import InternalScalarRef from './refs/scalar';
import InternalUnionRef from './refs/union';
import { FieldKind, NormalizeSchemeBuilderOptions, RootName, SchemaTypes } from './types';

export * from './plugins';
export * from './types';
export * from './utils';

const SchemaBuilder = SchemaBuilderClass as unknown as {
  registerPlugin: typeof SchemaBuilderClass.registerPlugin;
  allowPluginReRegistration: boolean;

  new <Types extends Partial<PothosSchemaTypes.UserSchemaTypes> = {}>(
    options: NormalizeSchemeBuilderOptions<PothosSchemaTypes.ExtendDefaultTypes<Types>>,
  ): PothosSchemaTypes.SchemaBuilder<PothosSchemaTypes.ExtendDefaultTypes<Types>>;
};

export default SchemaBuilder;

export const FieldBuilder = InternalFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
  Kind extends Exclude<FieldKind, RootName> = Exclude<FieldKind, RootName>,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
  kind: FieldKind,
  graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
) => PothosSchemaTypes.FieldBuilder<Types, ParentShape, Kind>;

export type RootFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind = FieldKind,
> = PothosSchemaTypes.RootFieldBuilder<Types, ParentShape, Kind>;

export const RootFieldBuilder = InternalRootFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind = FieldKind,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
  kind: FieldKind,
  graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind],
) => PothosSchemaTypes.RootFieldBuilder<Types, ParentShape, Kind>;

export type QueryFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.QueryFieldBuilder<Types, ParentShape>;
export const QueryFieldBuilder = InternalQueryFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => PothosSchemaTypes.QueryFieldBuilder<Types, ParentShape>;

export type MutationFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.MutationFieldBuilder<Types, ParentShape>;
export const MutationFieldBuilder = InternalMutationFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => PothosSchemaTypes.MutationFieldBuilder<Types, ParentShape>;

export type SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;
export const SubscriptionFieldBuilder = InternalSubscriptionFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => PothosSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;

export type ObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;
export const ObjectFieldBuilder = InternalObjectFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
) => PothosSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;

export type InterfaceFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;
export const InterfaceFieldBuilder = InternalInterfaceFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
) => PothosSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;

export type InputFieldBuilder<
  Types extends SchemaTypes,
  Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject',
> = PothosSchemaTypes.InputFieldBuilder<Types, Kind>;
export const InputFieldBuilder = InternalInputFieldBuilder as new <
  Types extends SchemaTypes,
  Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject',
>(
  builder: SchemaBuilderClass<Types>,
  kind: Kind,
  typename: string,
) => PothosSchemaTypes.InputFieldBuilder<Types, Kind>;

export type BaseTypeRef = PothosSchemaTypes.BaseTypeRef;
export const BaseTypeRef = InternalBaseTypeRef as new (
  kind: 'Enum' | 'InputObject' | 'Interface' | 'Object' | 'Scalar' | 'Union',
  name: string,
) => PothosSchemaTypes.BaseTypeRef;

export type EnumRef<T, P = T> = PothosSchemaTypes.EnumRef<T, P>;
export const EnumRef = InternalEnumRef as new <T, P = T>(name: string) => PothosSchemaTypes.EnumRef<
  T,
  P
>;

export type InputObjectRef<T> = PothosSchemaTypes.InputObjectRef<T>;
export const InputObjectRef = InternalInputObjectRef as new <T>(
  name: string,
) => PothosSchemaTypes.InputObjectRef<T>;

export type InterfaceRef<T, P = T> = PothosSchemaTypes.InterfaceRef<T, P>;
export const InterfaceRef = InternalInterfaceRef as new <T, P = T>(
  name: string,
) => PothosSchemaTypes.InterfaceRef<T, P>;

export type ObjectRef<T, P = T> = PothosSchemaTypes.ObjectRef<T, P>;
export const ObjectRef = InternalObjectRef as new <T, P = T>(
  name: string,
) => PothosSchemaTypes.ObjectRef<T, P>;

export type ScalarRef<T, U, P = T> = PothosSchemaTypes.ScalarRef<T, U, P>;
export const ScalarRef = InternalScalarRef as new <T, U, P = T>(
  name: string,
) => PothosSchemaTypes.ScalarRef<T, U, P>;

export type UnionRef<T, P = T> = PothosSchemaTypes.UnionRef<T, P>;
export const UnionRef = InternalUnionRef as new <T, P = T>(
  name: string,
) => PothosSchemaTypes.UnionRef<T, P>;

export { default as BuildCache } from './build-cache';
export { default as BuiltinScalarRef } from './refs/builtin-scalar';
export { default as FieldRef } from './refs/field';
export { default as InputTypeRef } from './refs/input';
export { default as InputFieldRef } from './refs/input-field';
export { ImplementableInputObjectRef } from './refs/input-object';
export { ImplementableInterfaceRef } from './refs/interface';
export { ImplementableObjectRef } from './refs/object';
export { default as OutputTypeRef } from './refs/output';
