import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import InternalInputFieldBuilder from './fieldUtils/input';
import Field from './graphql/field';
import BuildCache from './build-cache';
import InternalFieldBuilder from './fieldUtils/builder';
import InternalRootFieldBuilder from './fieldUtils/root';
import InternalQueryFieldBuilder from './fieldUtils/query';
import InternalMutationFieldBuilder from './fieldUtils/mutation';
import InternalSubscriptionFieldBuilder from './fieldUtils/subscription';
import InternalObjectFieldBuilder from './fieldUtils/object';
import InternalInterfaceFieldBuilder from './fieldUtils/interface';
import SchemaBuilder from './builder';
import QueryType from './graphql/query';
import SubscriptionType from './graphql/subscription';
import MutationType from './graphql/mutation';
import { FieldKind, SchemaTypes } from './types';
import { BasePlugin } from './plugins';

export * from './types';
export * from './utils';
export * from './plugins';

export {
  BuildCache,
  EnumType,
  Field,
  InputObjectType,
  InterfaceType,
  ObjectType,
  QueryType,
  SubscriptionType,
  MutationType,
  ScalarType,
  UnionType,
};

export default SchemaBuilder as {
  new <Types extends GiraphQLSchemaTypes.PartialTypeInfo>(options?: {
    plugins?: BasePlugin[];
  }): GiraphQLSchemaTypes.SchemaBuilder<GiraphQLSchemaTypes.MergedTypeMap<Types>>;
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
  ): GiraphQLSchemaTypes.RootFieldBuilder<Types, ParentShape, Kind>;
};

export const QueryFieldBuilder = InternalQueryFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(): GiraphQLSchemaTypes.QueryFieldBuilder<
    Types,
    ParentShape
  >;
};

export const MutationFieldBuilder = InternalMutationFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(): GiraphQLSchemaTypes.RootFieldBuilder<
    Types,
    ParentShape
  >;
};

export const SubscriptionFieldBuilder = InternalSubscriptionFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(): GiraphQLSchemaTypes.SubscriptionFieldBuilder<
    Types,
    ParentShape
  >;
};

export const ObjectFieldBuilder = InternalObjectFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    name: string,
  ): GiraphQLSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;
};

export const InterfaceFieldBuilder = InternalInterfaceFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    name: string,
  ): GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;
};

export const InputFieldBuilder = InternalInputFieldBuilder as {
  new <Types extends SchemaTypes>(): GiraphQLSchemaTypes.InputFieldBuilder<Types>;
};
