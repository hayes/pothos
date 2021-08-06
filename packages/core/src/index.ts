import './types/global/index.js';
import BuildCache from './build-cache.js';
import SchemaBuilderClass from './builder.js';
import InternalFieldBuilder from './fieldUtils/builder.js';
import InternalInputFieldBuilder from './fieldUtils/input.js';
import InternalInterfaceFieldBuilder from './fieldUtils/interface.js';
import InternalMutationFieldBuilder from './fieldUtils/mutation.js';
import InternalObjectFieldBuilder from './fieldUtils/object.js';
import InternalQueryFieldBuilder from './fieldUtils/query.js';
import InternalRootFieldBuilder from './fieldUtils/root.js';
import InternalSubscriptionFieldBuilder from './fieldUtils/subscription.js';
import BaseTypeRef from './refs/base.js';
import BuiltinScalarRef from './refs/builtin-scalar.js';
import EnumRef from './refs/enum.js';
import FieldRef from './refs/field.js';
import InputTypeRef from './refs/input.js';
import InputFieldRef from './refs/input-field.js';
import InputObjectRef, { ImplementableInputObjectRef } from './refs/input-object.js';
import InterfaceRef, { ImplementableInterfaceRef } from './refs/interface.js';
import ObjectRef, { ImplementableObjectRef } from './refs/object.js';
import OutputTypeRef from './refs/output.js';
import ScalarRef from './refs/scalar.js';
import UnionRef from './refs/union.js';
import { FieldKind, NormalizeSchemeBuilderOptions, SchemaTypes } from './types/index.js';

export * from './plugins/index.js';
export * from './types/index.js';
export * from './utils/index.js';

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

const SchemaBuilder = SchemaBuilderClass as unknown as {
  registerPlugin: typeof SchemaBuilderClass.registerPlugin;
  allowPluginReRegistration: boolean;

  new <Types extends Partial<GiraphQLSchemaTypes.UserSchemaTypes> = {}>(
    options: NormalizeSchemeBuilderOptions<GiraphQLSchemaTypes.ExtendDefaultTypes<Types>>,
  ): GiraphQLSchemaTypes.SchemaBuilder<GiraphQLSchemaTypes.ExtendDefaultTypes<Types>>;
};

export default SchemaBuilder;

export const FieldBuilder = InternalFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
  Kind extends 'Interface' | 'Object' = 'Interface' | 'Object',
>(
  name: string,
) => GiraphQLSchemaTypes.FieldBuilder<Types, ParentShape, Kind>;

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

export const QueryFieldBuilder = InternalQueryFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.QueryFieldBuilder<Types, ParentShape>;

export const MutationFieldBuilder = InternalMutationFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.MutationFieldBuilder<Types, ParentShape>;

export const SubscriptionFieldBuilder = InternalSubscriptionFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;

export const ObjectFieldBuilder = InternalObjectFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;

export const InterfaceFieldBuilder = InternalInterfaceFieldBuilder as new <
  Types extends SchemaTypes,
  ParentShape,
>(
  name: string,
  builder: SchemaBuilderClass<Types>,
) => GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;

export const InputFieldBuilder = InternalInputFieldBuilder as new <
  Types extends SchemaTypes,
  Kind extends 'Arg' | 'InputObject' = 'Arg' | 'InputObject',
>(
  builder: SchemaBuilderClass<Types>,
  kind: Kind,
  typename: string,
) => GiraphQLSchemaTypes.InputFieldBuilder<Types, Kind>;
