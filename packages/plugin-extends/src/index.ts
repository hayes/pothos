import {
  RootType,
  BasePlugin,
  ObjectType,
  BuildCache,
  FieldMap,
  ObjectName,
  FieldBuilder,
  RootName,
} from '@giraphql/core';
import { GraphQLObjectType } from 'graphql';
import './global-types';

export default class ExtendsPlugin<Types extends GiraphQLSchemaTypes.TypeInfo>
  implements BasePlugin<Types> {
  fieldsForRootType(
    type: RootType<Types, RootName>,
    fields: FieldMap,
    built: GraphQLObjectType,
    cache: BuildCache,
  ) {
    return this.mergeFields(type.typename, fields, cache);
  }

  fieldsForObjectType(
    type: ObjectType<Types>,
    existingFields: FieldMap,
    built: GraphQLObjectType,
    cache: BuildCache,
  ) {
    return this.mergeFields(type.typename, existingFields, cache);
  }

  private mergeFields(typename: string, existingFields: FieldMap, cache: BuildCache) {
    let fields = existingFields;

    cache.types.forEach(entry => {
      if (entry.kind === 'Object' && entry.type.options.extends) {
        const shape = entry.type.options.extends[typename as ObjectName<Types>];

        if (shape) {
          fields = cache.mergeFields(typename, fields, shape(new FieldBuilder(typename)));
        }
      }
    });

    return fields;
  }
}
