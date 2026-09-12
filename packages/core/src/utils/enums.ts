import type { BaseEnum, EnumValues, PothosEnumValueConfig, SchemaTypes } from '../types/index.js';

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

  // TypeScript adds a reverse mapping (`[numericValue]: 'MemberName'`) for every numeric member.
  // Only skip keys that actually are one of those entries: a numeric key whose member maps back to
  // it. Filtering on `typeof Enum[Enum[key]] !== 'number'` alone also drops real string members
  // whose value happens to name a numeric member (`enum Mixed { A = 'B', B = 1 }`).
  // A computed member can be NaN (`enum E { A = Number('bad') }` emits `{ A: NaN, NaN: 'A' }`), and
  // NaN is never `===` itself, so that case needs its own comparison. Plain `===` is still the right
  // test for everything else: it also matches `-0` against the `"0"` key that TypeScript emits,
  // which `Object.is` would not.
  const isReverseMapping = (key: string) => {
    const value = Enum[key];

    if (typeof value !== 'string') {
      return false;
    }

    const mapped = Enum[value];
    const numericKey = Number(key);

    return (
      typeof mapped === 'number' &&
      (mapped === numericKey || (Number.isNaN(mapped) && Number.isNaN(numericKey)))
    );
  };

  for (const key of Object.keys(Enum).filter((key) => !isReverseMapping(key))) {
    result[key] = {
      value: Enum[key],
      pothosOptions: {},
      ...values?.[key],
    };
  }

  return result;
}
