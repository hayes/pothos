import {
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLInterfaceType,
  GraphQLInputType,
  GraphQLFieldConfig,
} from 'graphql';
import ObjectType from './graphql/object';
import InterfaceType from './graphql/interface';
import UnionType from './graphql/union';
import { EnumType } from '.';
import ScalarType from './graphql/scalar';
import InputObjectType from './graphql/input';
import {
  EnumValues,
  InputFields,
  TypeParam,
  FieldMap,
  InterfaceName,
  ScalarName,
  RootName,
  ObjectName,
} from './types';
import Field from './graphql/field';
import BuildCache from './build-cache';
import RootType from './graphql/root';

export default interface BasePlugin<
  Types extends GiraphQLSchemaTypes.TypeInfo = GiraphQLSchemaTypes.TypeInfo
> {
  fieldsForObjectType?(
    type: ObjectType<Types>,
    fields: FieldMap,
    built: GraphQLObjectType,
    cache: BuildCache,
  ): FieldMap;

  fieldsForRootType?(
    type: RootType<Types, RootName>,
    fields: FieldMap,
    built: GraphQLObjectType,
    cache: BuildCache,
  ): FieldMap;

  fieldsForInterfaceType?(
    type: InterfaceType<Types, InterfaceName<Types>>,
    fields: FieldMap,
    built: GraphQLInterfaceType,
    cache: BuildCache,
  ): FieldMap;

  visitRootType?(
    type: RootType<Types, RootName>,
    built: GraphQLObjectType,
    cache: BuildCache,
  ): void;

  visitObjectType?(type: ObjectType<Types>, built: GraphQLObjectType, cache: BuildCache): void;

  visitInterfaceType?(
    type: InterfaceType<Types, InterfaceName<Types>>,
    built: GraphQLInterfaceType,
    cache: BuildCache,
  ): void;

  visitUnionType?(
    type: UnionType<Types, ObjectName<Types>>,
    built: GraphQLUnionType,
    cache: BuildCache,
  ): void;

  visitEnumType?(type: EnumType<EnumValues>, built: GraphQLEnumType, cache: BuildCache): void;

  visitScalarType?(
    type: ScalarType<Types, ScalarName<Types>>,
    built: GraphQLScalarType,
    cache: BuildCache,
  ): void;

  visitInputObjectType?(
    type: InputObjectType<Types, {}, string>,
    built: GraphQLInputType,
    cache: BuildCache,
  ): void;

  updateFieldConfig?(
    name: string,
    type: Field<InputFields<Types>, Types, TypeParam<Types>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    cache: BuildCache,
  ): GraphQLFieldConfig<unknown, unknown>;
}
