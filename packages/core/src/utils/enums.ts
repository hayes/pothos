import { GraphQLEnumValueConfigMap } from 'graphql';
import { EnumValues, BaseEnum } from '..';

export function normalizeEnumValues(values: EnumValues): GraphQLEnumValueConfigMap {
  const result: GraphQLEnumValueConfigMap = {};

  if (Array.isArray(values)) {
    values.forEach((key) => {
      result[String(key)] = {};
    });
  } else {
    Object.entries(values).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        result[key] = value;
      } else if (typeof value === 'string') {
        result[value] = {};
      }
    });
  }

  return result;
}

export function valuesFromEnum(Enum: BaseEnum): GraphQLEnumValueConfigMap {
  const result: GraphQLEnumValueConfigMap = {};

  Object.keys(Enum)
    .filter((key) => typeof Enum[Enum[key]] !== 'number')
    .forEach((key) => {
      result[key] = {
        value: Enum[key],
      };
    });

  return result;
}
