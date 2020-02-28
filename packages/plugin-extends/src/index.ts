import {
  BasePlugin,
  ImplementedType,
  RootFieldsShape,
  RootFieldSet,
  RootName,
  FieldSet,
} from '@giraphql/core';
import './global-types';

export default class ExtendsPlugin implements BasePlugin {
  onType(type: ImplementedType, builder: GiraphQLSchemaTypes.SchemaBuilder<any>) {
    if (type.kind === 'Object') {
      const extendsMap = type.options.extends || {};
      Object.keys(extendsMap).forEach(key => {
        const shape = extendsMap[key];

        if (shape) {
          if (key === 'Query' || key === 'Mutation' || key === 'Subscription') {
            builder._addFields(new RootFieldSet(key, shape as RootFieldsShape<any, RootName>));
          } else {
            builder._addFields(new FieldSet(key, shape));
          }
        }
      });
    }
  }
}
