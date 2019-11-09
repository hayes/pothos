import {
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLInterfaceType,
  GraphQLInputType,
  GraphQLFieldConfig,
} from 'graphql';
import ObjectType from './object';
import InterfaceType from './interface';
import UnionType from './union';
import { EnumType } from '.';
import ScalarType from './scalar';
import InputObjectType from './input';
import { NamedTypeParam, EnumValues, InputFields, TypeParam } from './types';
import Field from './field';
import TypeStore from './store';

export default interface BasePlugin<Types extends SpiderSchemaTypes.TypeInfo> {
  visitObjectType?(
    type: ObjectType<{}, any[], Types, any>,
    built: GraphQLObjectType,
    store: TypeStore<Types>,
  ): void;

  visitInterfaceType?(
    type: InterfaceType<{}, Types, NamedTypeParam<Types>>,
    built: GraphQLInterfaceType,
    store: TypeStore<Types>,
  ): void;

  visitUnionType?(
    type: UnionType<Types, string, NamedTypeParam<Types>>,
    built: GraphQLUnionType,
    store: TypeStore<Types>,
  ): void;

  visitEnumType?(
    type: EnumType<Types, string, EnumValues>,
    built: GraphQLEnumType,
    store: TypeStore<Types>,
  ): void;

  visitScalarType?(
    type: ScalarType<Types, NamedTypeParam<Types>>,
    built: GraphQLScalarType,
    store: TypeStore<Types>,
  ): void;

  visitInputObjectType?(
    type: InputObjectType<Types, {}, {}, string>,
    built: GraphQLInputType,
    store: TypeStore<Types>,
  ): void;

  updateFieldConfig?(
    type: Field<InputFields<Types>, Types, TypeParam<Types>, TypeParam<Types>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    store: TypeStore<Types>,
  ): GraphQLFieldConfig<unknown, unknown>;
}
