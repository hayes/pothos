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
import { NamedTypeParam, EnumValues, InputFields, TypeParam, FieldMap } from './types';
import Field from './field';
import BuildCache from './build-cache';

export default interface BasePlugin<Types extends GiraphQLSchemaTypes.TypeInfo> {
  fieldsForObjectType?(
    type: ObjectType<{}, any[], Types, any>,
    fields: FieldMap<Types>,
    parentFields: FieldMap<Types>,
    built: GraphQLObjectType,
    cache: BuildCache<Types>,
  ): FieldMap<Types>;

  fieldsForInterfaceType?(
    type: InterfaceType<{}, Types, NamedTypeParam<Types>>,
    fields: FieldMap<Types>,
    built: GraphQLInterfaceType,
    cache: BuildCache<Types>,
  ): FieldMap<Types>;

  visitObjectType?(
    type: ObjectType<{}, any[], Types, any>,
    built: GraphQLObjectType,
    cache: BuildCache<Types>,
  ): void;

  visitInterfaceType?(
    type: InterfaceType<{}, Types, NamedTypeParam<Types>>,
    built: GraphQLInterfaceType,
    cache: BuildCache<Types>,
  ): void;

  visitUnionType?(
    type: UnionType<Types, string, NamedTypeParam<Types>>,
    built: GraphQLUnionType,
    cache: BuildCache<Types>,
  ): void;

  visitEnumType?(
    type: EnumType<Types, string, EnumValues>,
    built: GraphQLEnumType,
    cache: BuildCache<Types>,
  ): void;

  visitScalarType?(
    type: ScalarType<Types, NamedTypeParam<Types>>,
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
