import {
  BasePlugin,
  ImplementedType,
  ObjectFieldsShape,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  QueryFieldBuilder,
  MutationFieldBuilder,
  SubscriptionFieldBuilder,
  ObjectFieldBuilder,
} from '@giraphql/core';
import './global-types';

export default class ExtendsPlugin implements BasePlugin {
  onType(type: ImplementedType, builder: GiraphQLSchemaTypes.SchemaBuilder<any>) {
    if (type.kind === 'Object') {
      const extendsMap: {
        [s: string]:
          | ObjectFieldsShape<any, object>
          | QueryFieldsShape<any>
          | MutationFieldsShape<any>
          | SubscriptionFieldsShape<any>
          | undefined;
      } = type.options.extends || {};

      Object.keys(extendsMap).forEach((key) => {
        const shape = extendsMap[key];

        if (shape) {
          if (key === 'Query') {
            builder.addFields(key, () => (shape as QueryFieldsShape<any>)(new QueryFieldBuilder()));
          } else if (key === 'Mutation') {
            builder.addFields(key, () =>
              (shape as MutationFieldsShape<any>)(new MutationFieldBuilder()),
            );
          } else if (key === 'Subscription') {
            builder.addFields(key, () =>
              (shape as SubscriptionFieldsShape<any>)(new SubscriptionFieldBuilder()),
            );
          } else {
            builder.addFields(key, () =>
              (shape as ObjectFieldsShape<any, object>)(new ObjectFieldBuilder(key)),
            );
          }
        }
      });
    }
  }
}
