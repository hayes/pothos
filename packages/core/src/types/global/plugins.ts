/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import { GraphQLFieldResolver } from 'graphql';
import { SchemaTypes } from '../..';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {}

    export interface ResolverPluginData {
      parentFieldData?: GiraphQLSchemaTypes.FieldWrapData;
    }

    export interface FieldWrapData {
      resolve: GraphQLFieldResolver<unknown, object>;
    }
  }
}
