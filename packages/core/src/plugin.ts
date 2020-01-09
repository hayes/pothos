/* eslint-disable @typescript-eslint/no-explicit-any */

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
  ObjectName,
  RootName,
} from './types';
import Field from './graphql/field';
import BuildCache from './build-cache';
import RootType from './graphql/root';

export default interface BasePlugin<Types extends GiraphQLSchemaTypes.TypeInfo> {
  fieldsForObjectType?(
    type: ObjectType<any[], Types, ObjectName<Types>>,
    fields: FieldMap<Types>,
    built: GraphQLObjectType,
    cache: BuildCache<Types>,
  ): FieldMap<Types>;

  fieldsForRootType?(
    type: RootType<Types, RootName>,
    fields: FieldMap<Types>,
    built: GraphQLObjectType,
    cache: BuildCache<Types>,
  ): FieldMap<Types>;

  fieldsForInterfaceType?(
    type: InterfaceType<Types, InterfaceName<Types>>,
    fields: FieldMap<Types>,
    built: GraphQLInterfaceType,
    cache: BuildCache<Types>,
  ): FieldMap<Types>;

  visitRootType?(
    type: RootType<Types, RootName>,
    built: GraphQLObjectType,
    cache: BuildCache<Types>,
  ): void;

  visitObjectType?(
    type: ObjectType<any[], Types, ObjectName<Types>>,
    built: GraphQLObjectType,
    cache: BuildCache<Types>,
  ): void;

  visitInterfaceType?(
    type: InterfaceType<Types, InterfaceName<Types>>,
    built: GraphQLInterfaceType,
    cache: BuildCache<Types>,
  ): void;

  visitUnionType?(
    type: UnionType<Types, string, ObjectName<Types>>,
    built: GraphQLUnionType,
    cache: BuildCache<Types>,
  ): void;

  visitEnumType?(
    type: EnumType<Types, string, EnumValues>,
    built: GraphQLEnumType,
    cache: BuildCache<Types>,
  ): void;

  visitScalarType?(
    type: ScalarType<Types, ScalarName<Types>>,
    built: GraphQLScalarType,
    cache: BuildCache<Types>,
  ): void;

  visitInputObjectType?(
    type: InputObjectType<Types, {}, {}, string>,
    built: GraphQLInputType,
    cache: BuildCache<Types>,
  ): void;

  updateFieldConfig?(
    name: string,
    type: Field<InputFields<Types>, Types, TypeParam<Types>, TypeParam<Types>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    cache: BuildCache<Types>,
  ): GraphQLFieldConfig<unknown, unknown>;
}
