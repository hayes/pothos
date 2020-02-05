import {
  BasePlugin,
  BuildCache,
  FieldMap,
  FieldBuilder,
  BuildCacheEntryWithFields,
} from '@giraphql/core';
import './global-types';

export default class ExtendsPlugin implements BasePlugin {
  updateFields(entry: BuildCacheEntryWithFields, fields: FieldMap, cache: BuildCache) {
    return this.mergeFields(entry.type.typename, fields, cache);
  }

  private mergeFields(typename: string, existingFields: FieldMap, cache: BuildCache) {
    let fields = existingFields;

    cache.types.forEach(entry => {
      if (entry.kind === 'Object' && entry.type.options.extends) {
        const shape = entry.type.options.extends[typename];

        if (shape) {
          fields = cache.mergeFields(typename, fields, shape(new FieldBuilder(typename)));
        }
      }
    });

    return fields;
  }
}
