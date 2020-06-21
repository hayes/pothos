import { GraphQLNamedType, GraphQLObjectType } from 'graphql';

import SchemaBuilder, {
  BasePlugin,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  QueryFieldBuilder,
  MutationFieldBuilder,
  SubscriptionFieldBuilder,
  ObjectFieldBuilder,
  getObjectOptions,
  SchemaTypes,
} from '@giraphql/core';
import './global-types';

export default class ExtendsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onType(type: GraphQLNamedType, builder: GiraphQLSchemaTypes.SchemaBuilder<any>) {
    if (type instanceof GraphQLObjectType) {
      const extendsMap = getObjectOptions(type).extends || {};

      Object.keys(extendsMap).forEach((key) => {
        const shape = extendsMap[key as keyof typeof extendsMap];

        if (shape) {
          if (key === 'Query') {
            builder.queryFields(() =>
              (shape as QueryFieldsShape<any>)(new QueryFieldBuilder(builder)),
            );
          } else if (key === 'Mutation') {
            builder.mutationFields(() =>
              (shape as MutationFieldsShape<any>)(new MutationFieldBuilder(builder)),
            );
          } else if (key === 'Subscription') {
            builder.subscriptionFields(() =>
              (shape as SubscriptionFieldsShape<any>)(new SubscriptionFieldBuilder(builder)),
            );
          } else {
            builder.objectFields(key, () => shape(new ObjectFieldBuilder(key, builder) as never));
          }
        }
      });
    }
  }
}

SchemaBuilder.registerPlugin('GiraphQLExtends', ExtendsPlugin);
