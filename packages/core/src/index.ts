/* eslint-disable @typescript-eslint/no-redeclare */
import './types/global';
import { SchemaBuilder as SchemaBuilderClass } from './builder';
import { FieldBuilder as InternalFieldBuilder } from './fieldUtils/builder';
import { InputFieldBuilder as InternalInputFieldBuilder } from './fieldUtils/input';
import { InterfaceFieldBuilder as InternalInterfaceFieldBuilder } from './fieldUtils/interface';
import { MutationFieldBuilder as InternalMutationFieldBuilder } from './fieldUtils/mutation';
import { ObjectFieldBuilder as InternalObjectFieldBuilder } from './fieldUtils/object';
import { QueryFieldBuilder as InternalQueryFieldBuilder } from './fieldUtils/query';
import { RootFieldBuilder as InternalRootFieldBuilder } from './fieldUtils/root';
import { SubscriptionFieldBuilder as InternalSubscriptionFieldBuilder } from './fieldUtils/subscription';
import { BaseTypeRef as InternalBaseTypeRef } from './refs/base';
import { EnumRef as InternalEnumRef } from './refs/enum';
import { InputListRef as InternalInputListRef } from './refs/input-list';
import { InputObjectRef as InternalInputObjectRef } from './refs/input-object';
import { InterfaceRef as InternalInterfaceRef } from './refs/interface';
import { ListRef as InternalListRef } from './refs/list';
import { ObjectRef as InternalObjectRef } from './refs/object';
import { ScalarRef as InternalScalarRef } from './refs/scalar';
import { UnionRef as InternalUnionRef } from './refs/union';
import type {
  AddVersionedDefaultsToBuilderOptions,
  FieldKind,
  NormalizeSchemeBuilderOptions,
  RootName,
  SchemaTypes,
} from './types';

export * from './errors';
export * from './plugins';
export * from './types';
export * from './utils';

const SchemaBuilder = SchemaBuilderClass as unknown as {
  registerPlugin: typeof SchemaBuilderClass.registerPlugin;
  allowPluginReRegistration: boolean;

  new <Types extends Partial<PothosSchemaTypes.UserSchemaTypes> = {}>(
    options: Types extends { Defaults: 'v3' }
      ? AddVersionedDefaultsToBuilderOptions<PothosSchemaTypes.ExtendDefaultTypes<Types>, 'v3'>
      : NormalizeSchemeBuilderOptions<PothosSchemaTypes.ExtendDefaultTypes<Types>>,
  ): PothosSchemaTypes.SchemaBuilder<PothosSchemaTypes.ExtendDefaultTypes<Types>>;
};

export default SchemaBuilder;

export const FieldBuilder = InternalFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
  Kind extends Exclude<FieldKind, RootName> = Exclude<FieldKind, RootName>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
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
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
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
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.QueryFieldBuilder<Types, ParentShape>;

export type MutationFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.MutationFieldBuilder<Types, ParentShape>;
export const MutationFieldBuilder = InternalMutationFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.MutationFieldBuilder<Types, ParentShape>;

export type SubscriptionFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;
export const SubscriptionFieldBuilder = InternalSubscriptionFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;

export type ObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;
export const ObjectFieldBuilder = InternalObjectFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;

export type InterfaceFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;
export const InterfaceFieldBuilder = InternalInterfaceFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;

export type InputFieldBuilder<
  Types extends SchemaTypes,
  Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject',
> = PothosSchemaTypes.InputFieldBuilder<Types, Kind>;
export const InputFieldBuilder = InternalInputFieldBuilder as new <
  Types extends SchemaTypes,
  Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject',
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind: Kind,
  typename: string,
) => PothosSchemaTypes.InputFieldBuilder<Types, Kind>;

export type BaseTypeRef<Types extends SchemaTypes, T> = PothosSchemaTypes.BaseTypeRef<Types, T>;
export const BaseTypeRef = InternalBaseTypeRef as new <Types extends SchemaTypes, T>(
  kind: 'Enum' | 'InputObject' | 'Interface' | 'Object' | 'Scalar' | 'Union',
  name: string,
) => PothosSchemaTypes.BaseTypeRef<Types, T>;

export type EnumRef<Types extends SchemaTypes, T, P = T> = PothosSchemaTypes.EnumRef<Types, T, P>;
export const EnumRef = InternalEnumRef as new <Types extends SchemaTypes, T, P = T>(
  name: string,
) => PothosSchemaTypes.EnumRef<Types, T, P>;

export type InputObjectRef<Types extends SchemaTypes, T> = PothosSchemaTypes.InputObjectRef<
  Types,
  T
>;
export const InputObjectRef = InternalInputObjectRef as new <Types extends SchemaTypes, T>(
  name: string,
) => PothosSchemaTypes.InputObjectRef<Types, T>;

export type InputListRef<Types extends SchemaTypes, T> = PothosSchemaTypes.InputListRef<Types, T>;
export const InputListRef = InternalInputListRef as new <Types extends SchemaTypes, T>(
  name: string,
  required: boolean,
) => PothosSchemaTypes.InputListRef<Types, T>;

export type InterfaceRef<Types extends SchemaTypes, T, P = T> = PothosSchemaTypes.InterfaceRef<
  Types,
  T,
  P
>;
export const InterfaceRef = InternalInterfaceRef as new <Types extends SchemaTypes, T, P = T>(
  name: string,
) => PothosSchemaTypes.InterfaceRef<Types, T, P>;

export type ObjectRef<Types extends SchemaTypes, T, P = T> = PothosSchemaTypes.ObjectRef<
  Types,
  T,
  P
>;
export const ObjectRef = InternalObjectRef as new <Types extends SchemaTypes, T, P = T>(
  name: string,
) => PothosSchemaTypes.ObjectRef<Types, T, P>;

export type ScalarRef<Types extends SchemaTypes, T, U, P = T> = PothosSchemaTypes.ScalarRef<
  Types,
  T,
  U,
  P
>;
export const ScalarRef = InternalScalarRef as new <Types extends SchemaTypes, T, U, P = T>(
  name: string,
) => PothosSchemaTypes.ScalarRef<Types, T, U, P>;

export type UnionRef<Types extends SchemaTypes, T, P = T> = PothosSchemaTypes.UnionRef<Types, T, P>;
export const UnionRef = InternalUnionRef as new <Types extends SchemaTypes, T, P = T>(
  name: string,
) => PothosSchemaTypes.UnionRef<Types, T, P>;

export type ListRef<Types extends SchemaTypes, T, P = T> = PothosSchemaTypes.ListRef<Types, T, P>;
export const ListRef = InternalListRef as new <Types extends SchemaTypes, T, P = T>(
  name: string,
  nullable: boolean,
) => PothosSchemaTypes.ListRef<Types, T, P>;

export { BuildCache } from './build-cache';
export { ArgumentRef } from './refs/arg';
export { BuiltinScalarRef } from './refs/builtin-scalar';
export { FieldRef } from './refs/field';
export { InputTypeRef } from './refs/input';
export { InputFieldRef } from './refs/input-field';
export { ImplementableInputObjectRef } from './refs/input-object';
export { ImplementableInterfaceRef } from './refs/interface';
export { MutationRef } from './refs/mutation';
export { ImplementableObjectRef } from './refs/object';
export { OutputTypeRef } from './refs/output';
export { QueryRef } from './refs/query';
export { SubscriptionRef } from './refs/subscription';
