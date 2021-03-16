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
import BaseTypeRef from './refs/base';
import BuiltinScalarRef from './refs/builtin-scalar';
import EnumRef from './refs/enum';
import FieldRef from './refs/field';
import InputTypeRef from './refs/input';
import InputFieldRef from './refs/input-field';
import InputObjectRef, { ImplementableInputObjectRef } from './refs/input-object';
import InterfaceRef, { ImplementableInterfaceRef } from './refs/interface';
import ObjectRef, { ImplementableObjectRef } from './refs/object';
import OutputTypeRef from './refs/output';
import ScalarRef from './refs/scalar';
import UnionRef from './refs/union';
import { FieldKind, NormalizeSchemeBuilderOptions, SchemaTypes } from './types';

export * from './plugins';
export * from './types';
export * from './utils';

export {
  BaseTypeRef,
  BuildCache,
  BuiltinScalarRef,
  EnumRef,
  FieldRef,
  ImplementableInputObjectRef,
  ImplementableInterfaceRef,
  ImplementableObjectRef,
  InputFieldRef,
  InputObjectRef,
  InputTypeRef,
  InterfaceRef,
  ObjectRef,
  OutputTypeRef,
  ScalarRef,
  UnionRef,
};

const SchemaBuilder = SchemaBuilderClass as {
  registerPlugin: typeof SchemaBuilderClass.registerPlugin;
  allowPluginReRegistration: boolean;

  new <Types extends Partial<GiraphQLSchemaTypes.UserSchemaTypes> = {}>(
    options: NormalizeSchemeBuilderOptions<GiraphQLSchemaTypes.ExtendDefaultTypes<Types>>,
  ): GiraphQLSchemaTypes.SchemaBuilder<GiraphQLSchemaTypes.ExtendDefaultTypes<Types>>;
};

export default SchemaBuilder;

export const FieldBuilder = InternalFieldBuilder as {
  new <
    Types extends SchemaTypes,
    ParentShape,
    Kind extends 'Interface' | 'Object' = 'Interface' | 'Object'
  >(
    name: string,
  ): GiraphQLSchemaTypes.FieldBuilder<Types, ParentShape, Kind>;
};

export const RootFieldBuilder = InternalRootFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind>(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
    graphqlKind: GiraphQLSchemaTypes.GiraphQLKindToGraphQLType[FieldKind],
  ): GiraphQLSchemaTypes.RootFieldBuilder<Types, ParentShape, Kind>;
};

export const QueryFieldBuilder = InternalQueryFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.QueryFieldBuilder<Types, ParentShape>;
};

export const MutationFieldBuilder = InternalMutationFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.MutationFieldBuilder<Types, ParentShape>;
};

export const SubscriptionFieldBuilder = InternalSubscriptionFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;
};

export const ObjectFieldBuilder = InternalObjectFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;
};

export const InterfaceFieldBuilder = InternalInterfaceFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;
};

export const InputFieldBuilder = InternalInputFieldBuilder as {
  new <Types extends SchemaTypes, Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject'>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    kind: Kind,
    typename: string,
  ): GiraphQLSchemaTypes.InputFieldBuilder<Types, Kind>;
};
