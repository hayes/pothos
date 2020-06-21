/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  SchemaTypes,
} from '@giraphql/core';
import ExtendsPlugin from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      GiraphQLExtends: ExtendsPlugin<Types>;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      extends?: {
        [K in keyof Types['Objects']]?: Types['Objects'][K];
      } & {
        Query?: QueryFieldsShape<Types>;
        Mutation?: MutationFieldsShape<Types>;
        Subscription?: SubscriptionFieldsShape<Types>;
      };
    }
  }
}
