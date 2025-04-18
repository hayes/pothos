// @ts-nocheck
import type { NormalizeArgs, SchemaTypes } from '../core/index.ts';
import type { GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLNamedType, GraphQLObjectType, GraphQLSchema, GraphQLUnionType, } from 'https://cdn.skypack.dev/graphql?dts';
import type { AddGraphQLEnumTypeOptions, AddGraphQLInputTypeOptions, AddGraphQLInterfaceTypeOptions, AddGraphQLObjectTypeOptions, AddGraphQLUnionTypeOptions, EnumValuesWithShape, } from './types.ts';
import type { PothosAddGraphQLPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            addGraphQL: PothosAddGraphQLPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            add?: {
                schema?: GraphQLSchema;
                types?: GraphQLNamedType[] | Record<string, GraphQLNamedType>;
            };
        }
        export interface SchemaBuilder<Types extends SchemaTypes> {
            addGraphQLObject: <Shape>(type: GraphQLObjectType<Shape>, ...args: NormalizeArgs<[
                options: AddGraphQLObjectTypeOptions<Types, Shape>
            ]>) => ObjectRef<Types, Shape>;
            addGraphQLInterface: <Shape>(type: GraphQLInterfaceType, ...args: NormalizeArgs<[
                options: AddGraphQLInterfaceTypeOptions<Types, Shape>
            ]>) => InterfaceRef<Types, Shape>;
            addGraphQLUnion: <Shape>(type: GraphQLUnionType, ...args: NormalizeArgs<[
                options: AddGraphQLUnionTypeOptions<Types, ObjectRef<Types, Shape>>
            ]>) => UnionRef<Types, Shape>;
            addGraphQLEnum: <Shape extends number | string>(type: GraphQLEnumType, ...args: NormalizeArgs<[
                options: AddGraphQLEnumTypeOptions<Types, EnumValuesWithShape<Types, Shape>>
            ]>) => EnumRef<Types, Shape>;
            addGraphQLInput: <Shape extends {}>(type: GraphQLInputObjectType, ...args: NormalizeArgs<[
                options: AddGraphQLInputTypeOptions<Types, Shape>
            ]>) => InputObjectRef<Types, Shape>;
        }
    }
}
