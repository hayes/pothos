/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ObjectName,
  ObjectFieldsShape,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
} from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<Types extends TypeInfo, Shape> {
      extends?: {
        [K in ObjectName<Types>]?: ObjectFieldsShape<Types, Types['Object'][K]>;
      } & {
        Query?: QueryFieldsShape<Types>;
        Mutation?: MutationFieldsShape<Types>;
        Subscription?: SubscriptionFieldsShape<Types>;
      };
    }
  }
}
