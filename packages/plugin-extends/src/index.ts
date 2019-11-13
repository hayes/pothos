import {
  BasePlugin,
  ObjectType,
  BuildCache,
  FieldMap,
  ObjectName,
  FieldBuilder,
} from '@giraphql/core';
import { GraphQLObjectType } from 'graphql';
import './global-types';

export default class ExtendsPlugin<Types extends GiraphQLSchemaTypes.TypeInfo>
  implements BasePlugin<Types> {
  fieldsForObjectType(
    type: ObjectType<{}, any[], Types, any>,
    existingFields: FieldMap<Types>,
    parentFields: FieldMap<Types>,
    built: GraphQLObjectType,
    cache: BuildCache<Types>,
  ) {
    let fields = existingFields;

    cache.types.forEach(entry => {
      if (entry.kind === 'Object' && entry.type.options.extends) {
        const shape = entry.type.options.extends[type.typename as ObjectName<Types>];

        if (shape) {
          fields = cache.mergeFields(
            type.typename,
            fields,
            shape(new FieldBuilder(parentFields, type.typename)),
          );
        }
      }
    });

    return fields;
  }
}
