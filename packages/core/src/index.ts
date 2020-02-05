import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import InternalInputFieldBuilder from './fieldUtils/input';
import BasePlugin from './plugin';
import Field from './graphql/field';
import BuildCache from './build-cache';
import InternalFieldBuilder from './fieldUtils/builder';
import InternalRootFieldBuilder from './fieldUtils/root';
import RootType from './graphql/root';
import FieldSet from './graphql/field-set';
import RootFieldSet from './graphql/root-field-set';
import SchemaBuilder from './builder';
import BaseType from './graphql/base';
import { FieldKind } from './types';

export * from './types';
export * from './utils';

export {
  BaseType,
  BasePlugin,
  BuildCache,
  EnumType,
  Field,
  FieldSet,
  InputObjectType,
  InterfaceType,
  ObjectType,
  RootType,
  RootFieldSet,
  ScalarType,
  UnionType,
};

export default SchemaBuilder as {
  new <Types extends GiraphQLSchemaTypes.PartialTypeInfo>(options?: {
    plugins?: BasePlugin[];
    stateful?: boolean;
  }): GiraphQLSchemaTypes.SchemaBuilder<Types>;
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
