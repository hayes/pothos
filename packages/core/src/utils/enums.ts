import { BaseEnum, EnumValues, PothosEnumValueConfig, SchemaTypes } from '../types';

export function normalizeEnumValues<Types extends SchemaTypes>(
  values: EnumValues<SchemaTypes>,
): Record<string, PothosEnumValueConfig<Types>> {
  const result: Record<string, PothosEnumValueConfig<Types>> = {};

  if (Array.isArray(values)) {
    values.forEach((key) => {
      result[String(key)] = {
        pothosOptions: {},
      };
    });
  } else {
    Object.entries(values).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        result[key] = {
          ...value,
          pothosOptions: value as PothosSchemaTypes.EnumValueConfig<Types>,
        };
      } else if (typeof value === 'string') {
        result[value] = {
          pothosOptions: {},
        };
      }
    });
  }

  return result;
}

export function valuesFromEnum<Types extends SchemaTypes>(
  Enum: BaseEnum,
): Record<string, PothosEnumValueConfig<Types>> {
  const result: Record<string, PothosEnumValueConfig<Types>> = {};

  Object.keys(Enum)
    .filter((key) => typeof Enum[Enum[key]] !== 'number')
    .forEach((key) => {
      result[key] = {
        value: Enum[key],
        pothosOptions: {},
      };
    });

  return result;
}
