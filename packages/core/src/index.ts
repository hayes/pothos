import './types/global';

import InternalInputFieldBuilder from './fieldUtils/input';
import BuildCache from './build-cache';
import InternalFieldBuilder from './fieldUtils/builder';
import InternalRootFieldBuilder from './fieldUtils/root';
import InternalQueryFieldBuilder from './fieldUtils/query';
import InternalMutationFieldBuilder from './fieldUtils/mutation';
import InternalSubscriptionFieldBuilder from './fieldUtils/subscription';
import InternalObjectFieldBuilder from './fieldUtils/object';
import InternalInterfaceFieldBuilder from './fieldUtils/interface';
import SchemaBuilder from './builder';
import { FieldKind, SchemaTypes } from './types';
import { BasePlugin } from './plugins';
import EnumRef from './refs/enum';
import InputObjectRef, { ImplementableInputObjectRef } from './refs/input';
import InterfaceRef, { ImplementableInterfaceRef } from './refs/interface';
import ObjectRef, { ImplementableObjectRef } from './refs/object';
import ScalarRef from './refs/scalar';
import UnionRef from './refs/union';
import FieldRef from './refs/field';
import InputFieldRef from './refs/input-field';

export * from './types';
export * from './utils';
export * from './plugins';

export {
  BuildCache,
  EnumRef,
  InputObjectRef,
  InterfaceRef,
  ObjectRef,
  ScalarRef,
  UnionRef,
  ImplementableObjectRef,
  ImplementableInterfaceRef,
  ImplementableInputObjectRef,
  FieldRef,
  InputFieldRef,
};

export default SchemaBuilder as {
  new <Types extends Partial<GiraphQLSchemaTypes.TypeInfo>>(options?: {
    plugins?: BasePlugin[];
  }): GiraphQLSchemaTypes.SchemaBuilder<GiraphQLSchemaTypes.ExtendDefaultTypes<Types>>;
};

export const FieldBuilder = InternalFieldBuilder as {
  new <
    Types extends SchemaTypes,
    ParentShape,
    Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
  >(
    name: string,
  ): GiraphQLSchemaTypes.FieldBuilder<Types, ParentShape, Kind>;
};

export const RootFieldBuilder = InternalRootFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind>(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    kind: FieldKind,
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
    kind?: FieldKind,
  ): GiraphQLSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;
};

export const InterfaceFieldBuilder = InternalInterfaceFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    kind?: FieldKind,
  ): GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;
};

export const InputFieldBuilder = InternalInputFieldBuilder as {
  new <Types extends SchemaTypes>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    kind: 'InputObject' | 'Arg',
  ): GiraphQLSchemaTypes.InputFieldBuilder<Types>;
};
