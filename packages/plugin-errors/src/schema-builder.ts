import SchemaBuilder, { type ObjectParam, type SchemaTypes } from '@pothos/core';
import { defaultTypeResolver, type GraphQLAbstractType, type GraphQLResolveInfo } from 'graphql';
import { errorTypeMap, extractAndSortErrorTypes } from './utils';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.errorUnion = function errorUnion(name, options) {
  const {
    types,
    resolveType: customResolveType,
    omitDefaultTypes = false,
    ...unionOptions
  } = options;

  const allTypes = [
    ...new Set([...types, ...(omitDefaultTypes ? [] : (this.options.errors?.defaultTypes ?? []))]),
  ] as ObjectParam<SchemaTypes>[];

  const errorTypes = extractAndSortErrorTypes(allTypes);

  return this.unionType(name, {
    ...unionOptions,
    types: allTypes,
    resolveType: (
      parent: unknown,
      context: object,
      info: GraphQLResolveInfo,
      abstractType: GraphQLAbstractType,
    ) => {
      if (typeof parent === 'object' && parent !== null) {
        const mappedType = errorTypeMap.get(parent as object);
        if (mappedType) {
          return this.configStore.getTypeConfig(mappedType as never).name;
        }
      }

      if (customResolveType) {
        const result = (customResolveType as Function)(parent, context, info, abstractType);
        if (result !== undefined) {
          return result;
        }
      }

      return defaultTypeResolver(parent, context, info, abstractType);
    },
    extensions: {
      ...unionOptions.extensions,
      pothosErrorTypes: errorTypes.length > 0 ? errorTypes : undefined,
    },
  } as never);
};
