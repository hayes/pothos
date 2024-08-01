import type { BaseEnum, EnumValues, PothosEnumValueConfig, SchemaTypes } from '../types';

export function normalizeEnumValues<Types extends SchemaTypes>(
  values: EnumValues<SchemaTypes>,
): Record<string, PothosEnumValueConfig<Types>> {
  const result: Record<string, PothosEnumValueConfig<Types>> = {};

  if (Array.isArray(values)) {
    for (const key of values) {
      result[String(key)] = {
        pothosOptions: {},
      };
    }
  } else {
    for (const [key, value] of Object.entries(values)) {
      if (value && typeof value === 'object') {
        result[key] = {
          ...value,
          pothosOptions: value as PothosSchemaTypes.EnumValueConfig<Types>,
        };
      } else if (typeof value === 'string') {
        result[value] = {
          pothosOptions: {},
        };
      }
    }
  }

  return result;
}

export function valuesFromEnum<Types extends SchemaTypes>(
  Enum: BaseEnum,
  values?: Record<string, Omit<PothosSchemaTypes.EnumValueConfig<Types>, 'value'>>,
): Record<string, PothosEnumValueConfig<Types>> {
  const result: Record<string, PothosEnumValueConfig<Types>> = {};

  for (const key of Object.keys(Enum).filter((key) => typeof Enum[Enum[key]] !== 'number')) {
    result[key] = {
      value: Enum[key],
      pothosOptions: {},
      ...values?.[key],
    };
  }

  return result;
}
