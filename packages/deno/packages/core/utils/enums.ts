// @ts-nocheck
import { GiraphQLEnumValueConfig, SchemaTypes } from '../types/index.ts';
import { BaseEnum, EnumValues } from '../index.ts';
export function normalizeEnumValues<Types extends SchemaTypes>(values: EnumValues<SchemaTypes>): Record<string, GiraphQLEnumValueConfig<Types>> {
    const result: Record<string, GiraphQLEnumValueConfig<Types>> = {};
    if (Array.isArray(values)) {
        values.forEach((key) => {
            result[String(key)] = {
                giraphqlOptions: {},
            };
        });
    }
    else {
        Object.entries(values).forEach(([key, value]) => {
            if (value && typeof value === "object") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                result[key] = {
                    ...value,
                    giraphqlOptions: value as GiraphQLSchemaTypes.EnumValueConfig<Types>,
                };
            }
            else if (typeof value === "string") {
                result[value] = {
                    giraphqlOptions: {},
                };
            }
        });
    }
    return result;
}
export function valuesFromEnum<Types extends SchemaTypes>(Enum: BaseEnum): Record<string, GiraphQLEnumValueConfig<Types>> {
    const result: Record<string, GiraphQLEnumValueConfig<Types>> = {};
    Object.keys(Enum)
        .filter((key) => typeof Enum[Enum[key]] !== "number")
        .forEach((key) => {
        result[key] = {
            value: Enum[key],
            giraphqlOptions: {},
        };
    });
    return result;
}
