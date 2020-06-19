/* eslint-disable @typescript-eslint/no-unused-vars */
import { GraphQLFieldResolver } from 'graphql';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ResolverPluginData {
      parentFieldData?: GiraphQLSchemaTypes.FieldWrapData;
    }

    export interface FieldWrapData {
      resolve: GraphQLFieldResolver<unknown, object>;
    }
  }
}
