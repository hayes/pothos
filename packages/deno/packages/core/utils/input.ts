// @ts-nocheck
import type { BuildCache } from '../build-cache.ts';
import { PothosSchemaError } from '../errors.ts';
import { PothosInputFieldConfig, PothosInputFieldType, PothosTypeConfig, SchemaTypes, } from '../types/index.ts';
import { unwrapInputFieldType } from './params.ts';
export interface InputTypeFieldsMapping<Types extends SchemaTypes, T> {
    configs: Record<string, PothosInputFieldConfig<Types>>;
    map: InputFieldsMapping<Types, T> | null;
}
export type InputFieldMapping<Types extends SchemaTypes, T> = {
    kind: "Enum";
    isList: boolean;
    config: PothosInputFieldConfig<Types>;
    value: T;
} | {
    kind: "InputObject";
    config: PothosInputFieldConfig<Types>;
    isList: boolean;
    value: T | null;
    fields: InputTypeFieldsMapping<Types, T>;
} | {
    kind: "Scalar";
    isList: boolean;
    config: PothosInputFieldConfig<Types>;
    value: T;
};
export type InputFieldsMapping<Types extends SchemaTypes, T> = Map<string, InputFieldMapping<Types, T>>;
export function resolveInputTypeConfig<Types extends SchemaTypes>(type: PothosInputFieldType<Types>, buildCache: BuildCache<Types>): Extract<PothosTypeConfig, {
    kind: "Enum" | "InputObject" | "Scalar";
}> {
    if (type.kind === "List") {
        return resolveInputTypeConfig(type.type, buildCache);
    }
    const config = buildCache.getTypeConfig(type.ref);
    if (config.kind === "Enum" || config.kind === "Scalar" || config.kind === "InputObject") {
        return config;
    }
    throw new PothosSchemaError(`Unexpected config type ${config.kind} for input ref ${String(type.ref)}`);
}
export function mapInputFields<Types extends SchemaTypes, T>(inputs: Record<string, PothosInputFieldConfig<Types>>, buildCache: BuildCache<Types>, mapper: (config: PothosInputFieldConfig<Types>) => T | null): InputFieldsMapping<Types, T> | null {
    const filterMappings = new Map<InputFieldsMapping<Types, T>, InputFieldsMapping<Types, T>>();
    return filterMapped(internalMapInputFields(inputs, buildCache, mapper, new Map<string, InputTypeFieldsMapping<Types, T>>()));
    function filterMapped(map: InputFieldsMapping<Types, T>) {
        if (filterMappings.has(map)) {
            return filterMappings.get(map)!;
        }
        const filtered = new Map<string, InputFieldMapping<Types, T>>();
        filterMappings.set(map, filtered);
        map.forEach((mapping, fieldName) => {
            if (mapping.kind === "Enum" || mapping.kind === "Scalar") {
                filtered.set(fieldName, mapping);
                return;
            }
            const hasNestedMappings = checkForMappings(mapping.fields.map!);
            if (mapping.value !== null || hasNestedMappings) {
                const filteredTypeFields = filterMapped(mapping.fields.map!);
                const mappingForType = {
                    ...mapping,
                    fields: {
                        configs: mapping.fields.configs,
                        map: filteredTypeFields,
                    },
                };
                filtered.set(fieldName, mappingForType);
            }
        });
        return filtered.size > 0 ? filtered : null;
    }
    function checkForMappings(map: InputFieldsMapping<Types, T>, hasMappings = new Map<InputFieldsMapping<Types, T>, boolean>()): boolean {
        if (hasMappings.has(map)) {
            return hasMappings.get(map)!;
        }
        hasMappings.set(map, false);
        let result = false;
        map.forEach((mapping) => {
            if (mapping.value !== null) {
                result = true;
            }
            else if (mapping.kind === "InputObject" &&
                mapping.fields.map &&
                checkForMappings(mapping.fields.map, hasMappings)) {
                result = true;
            }
        });
        hasMappings.set(map, result);
        return result;
    }
}
function internalMapInputFields<Types extends SchemaTypes, T>(inputs: Record<string, PothosInputFieldConfig<Types>>, buildCache: BuildCache<Types>, mapper: (config: PothosInputFieldConfig<Types>) => T | null, seenTypes: Map<string, InputTypeFieldsMapping<Types, T>>) {
    const map = new Map<string, InputFieldMapping<Types, T>>();
    Object.keys(inputs).forEach((fieldName) => {
        const inputField = inputs[fieldName];
        const typeConfig = resolveInputTypeConfig(inputField.type, buildCache);
        const fieldMapping = mapper(inputField);
        if (typeConfig.kind === "Enum" || typeConfig.kind === "Scalar") {
            if (fieldMapping !== null) {
                map.set(fieldName, {
                    kind: typeConfig.kind,
                    isList: inputField.type.kind === "List",
                    config: inputField,
                    value: fieldMapping,
                });
            }
            return;
        }
        const inputFieldConfigs = buildCache.getInputTypeFieldConfigs(unwrapInputFieldType(inputField.type));
        if (!seenTypes.has(typeConfig.name)) {
            const typeEntry = {
                configs: inputFieldConfigs,
                map: new Map<string, InputFieldMapping<Types, T>>(),
            };
            seenTypes.set(typeConfig.name, typeEntry);
            typeEntry.map = internalMapInputFields(inputFieldConfigs, buildCache, mapper, seenTypes);
        }
        const typeFields = seenTypes.get(typeConfig.name)!;
        map.set(fieldName, {
            kind: typeConfig.kind,
            isList: inputField.type.kind === "List",
            config: inputField,
            value: fieldMapping,
            fields: typeFields,
        });
    });
    return map;
}
export function createInputValueMapper<Types extends SchemaTypes, T, Args extends unknown[] = [
]>(argMap: InputFieldsMapping<Types, T>, mapValue: (val: unknown, mapping: InputFieldMapping<Types, T>, ...args: Args) => unknown) {
    return function mapObject(obj: object, map: InputFieldsMapping<Types, T> = argMap, ...args: Args) {
        const mapped: Record<string, unknown> = { ...obj };
        map.forEach((field, fieldName) => {
            let fieldVal = (obj as Record<string, unknown>)[fieldName];
            if (fieldVal === null || fieldVal === undefined) {
                return;
            }
            if (field.kind === "InputObject" && field.fields.map) {
                fieldVal = field.isList
                    ? (fieldVal as (Record<string, unknown> | null)[]).map((val) => val && mapObject(val, field.fields.map!, ...args))
                    : mapObject(fieldVal as Record<string, unknown>, field.fields.map, ...args);
                mapped[fieldName] = fieldVal;
            }
            if (field.kind !== "InputObject" || field.value !== null) {
                mapped[fieldName] = field.isList
                    ? (fieldVal as unknown[]).map((val) => val == null ? val : mapValue(val, field, ...args))
                    : mapValue(fieldVal, field, ...args);
            }
        });
        return mapped;
    };
}
