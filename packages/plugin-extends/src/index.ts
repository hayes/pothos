import SchemaBuilder, {
  BasePlugin,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  QueryFieldBuilder,
  MutationFieldBuilder,
  SubscriptionFieldBuilder,
  ObjectFieldBuilder,
  SchemaTypes,
  GiraphQLTypeConfig,
  ObjectParam,
} from '@giraphql/core';
import './global-types';

export default class ExtendsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onTypeConfig(config: GiraphQLTypeConfig) {
    if (config.kind === 'Object') {
      const extendsMap = config.giraphqlOptions.extends || {};

      Object.keys(extendsMap).forEach((key) => {
        const shape = extendsMap[key as keyof typeof extendsMap];

        if (shape) {
          if (key === 'Query') {
            this.builder.queryFields(() =>
              (shape as QueryFieldsShape<any>)(new QueryFieldBuilder(this.builder)),
            );
          } else if (key === 'Mutation') {
            this.builder.mutationFields(() =>
              (shape as MutationFieldsShape<any>)(new MutationFieldBuilder(this.builder)),
            );
          } else if (key === 'Subscription') {
            this.builder.subscriptionFields(() =>
              (shape as SubscriptionFieldsShape<any>)(new SubscriptionFieldBuilder(this.builder)),
            );
          } else {
            this.builder.objectFields(key as ObjectParam<Types>, () =>
              shape(new ObjectFieldBuilder(key, this.builder) as never),
            );
          }
        }
      });
    }
  }
}

SchemaBuilder.registerPlugin('GiraphQLExtends', ExtendsPlugin);
