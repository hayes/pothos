import { GraphQLEnumValueConfig, GraphQLEnumValueConfigMap } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';

export function normalizeEnumValues(
  options: GiraphQLSchemaTypes.EnumTypeOptions<any>,
): GraphQLEnumValueConfigMap {
  return Array.isArray(options.values)
    ? (fromEntries(options.values.map((key) => [key, {}])) as GraphQLEnumValueConfigMap)
    : (fromEntries(
        Object.entries(options.values)
          .map(([key, value]) => {
            if (value && typeof value === 'object') {
              return [key, value];
            }

            if (typeof value === 'string') {
              return [value, {}];
            }

            return null;
          })
          .filter(Boolean) as [string, GraphQLEnumValueConfig][],
      ) as GraphQLEnumValueConfigMap);
}
