import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import InputFieldBuilder from './fieldUtils/input';
import BasePlugin from './plugin';
import Field from './graphql/field';
import BuildCache from './build-cache';
import FieldBuilder from './fieldUtils/builder';
import RootFieldBuilder from './fieldUtils/root';
import RootType from './graphql/root';
import FieldSet from './graphql/field-set';
import RootFieldSet from './graphql/root-field-set';
import SchemaBuilder from './builder';
import BaseType from './graphql/base';
import { MergedTypeMap } from './types';

export * from './types';
export * from './utils';

export {
  BaseType,
  BasePlugin,
  BuildCache,
  EnumType,
  Field,
  FieldBuilder,
  FieldSet,
  InputFieldBuilder,
  InputObjectType,
  InterfaceType,
  ObjectType,
  RootType,
  RootFieldBuilder,
  RootFieldSet,
  ScalarType,
  UnionType,
};

export default SchemaBuilder as {
  new <Types extends GiraphQLSchemaTypes.PartialTypeInfo>(options?: {
    plugins?: BasePlugin<MergedTypeMap<Types>>[];
    stateful?: boolean;
  }): GiraphQLSchemaTypes.SchemaBuilder<Types>;
};
