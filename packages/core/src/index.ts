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
import FieldSet from './graphql/field-set';
import RootFieldSet from './graphql/root-field-set';
import SchemaBuilder from './builder';
import BaseType from './graphql/base';
import QueryType from './graphql/query';
import SubscriptionType from './graphql/subscription';
import MutationType from './graphql/mutation';
import { FieldKind, MergedTypeMap } from './types';
import { BasePlugin } from './plugins';

export * from './types';
export * from './utils';
export * from './plugins';

export {
  BaseType,
  BuildCache,
  EnumType,
  Field,
  FieldSet,
  InputObjectType,
  InterfaceType,
  ObjectType,
  QueryType,
  SubscriptionType,
  MutationType,
  RootFieldSet,
  ScalarType,
  UnionType,
};

export default SchemaBuilder as {
  new <Types extends GiraphQLSchemaTypes.PartialTypeInfo>(options?: {
    plugins?: BasePlugin[];
    stateful?: boolean;
  }): GiraphQLSchemaTypes.SchemaBuilder<MergedTypeMap<Types>>;
};

export const FieldBuilder = InternalFieldBuilder as {
  new <
    Types extends GiraphQLSchemaTypes.TypeInfo,
    ParentShape,
    Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
  >(
    name: string,
  ): GiraphQLSchemaTypes.FieldBuilder<Types, ParentShape, Kind>;
};

export const RootFieldBuilder = InternalRootFieldBuilder as {
  new <Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape, Kind extends FieldKind = FieldKind>(
    name: string,
  ): GiraphQLSchemaTypes.RootFieldBuilder<Types, ParentShape, Kind>;
};

export const InputFieldBuilder = InternalInputFieldBuilder as {
  new <Types extends GiraphQLSchemaTypes.TypeInfo>(): GiraphQLSchemaTypes.InputFieldBuilder<Types>;
};
