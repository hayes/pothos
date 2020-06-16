/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ObjectFieldsShape,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  SchemaTypes,
} from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      extends?: {
        [K in Types['objects']]?: ObjectFieldsShape<Types, Types['objects']>;
      } & {
        Query?: QueryFieldsShape<Types>;
        Mutation?: MutationFieldsShape<Types>;
        Subscription?: SubscriptionFieldsShape<Types>;
      };
    }
  }
}
