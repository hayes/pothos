/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
} from 'graphql';
import { InputTypeRef, SchemaTypes } from '@pothos/core';
import {
  AddGraphQLEnumTypeOptions,
  AddGraphQLInputTypeOptions,
  AddGraphQLInterfaceTypeOptions,
  AddGraphQLObjectTypeOptions,
  AddGraphQLUnionTypeOptions,
  EnumValuesWithShape,
} from './types';

import type { PothosAddGraphQLPlugin } from '.';

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
      addGraphQLObject: <Shape>(
        type: GraphQLObjectType<Shape>,
        options: AddGraphQLObjectTypeOptions<Types, Shape>,
      ) => ObjectRef<Shape>;

      addGraphQLInterface: <Shape>(
        type: GraphQLInterfaceType,
        options: AddGraphQLInterfaceTypeOptions<Types, Shape>,
      ) => InterfaceRef<Shape>;

      addGraphQLUnion: <Shape>(
        type: GraphQLUnionType,
        options: AddGraphQLUnionTypeOptions<Types, ObjectRef<Shape>>,
      ) => UnionRef<Shape>;

      addGraphQLEnum: <Shape extends number | string>(
        type: GraphQLEnumType,
        options: AddGraphQLEnumTypeOptions<Types, EnumValuesWithShape<Types, Shape>>,
      ) => EnumRef<Shape>;

      addGraphQLInput: <Shape extends {}>(
        type: GraphQLInputObjectType,
        options: AddGraphQLInputTypeOptions<Types, Shape>,
      ) => InputTypeRef<Shape>;
    }
  }
}
