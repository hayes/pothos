// @ts-nocheck
import type { ConfigStore } from '../config-store.ts';
import { PothosSchemaError } from '../errors.ts';
import { BaseTypeRef } from '../refs/base.ts';
import { InputListRef } from '../refs/input-list.ts';
import { ListRef } from '../refs/list.ts';
import { FieldNullability, FieldRequiredness, InputType, InputTypeParam, OutputType, PothosInputFieldType, PothosOutputFieldType, SchemaTypes, TypeParam, } from '../types/index.ts';
export function unwrapOutputFieldType<Types extends SchemaTypes>(type: PothosOutputFieldType<Types>): OutputType<Types> {
    if (type.kind === "List") {
        return unwrapOutputFieldType(type.type);
    }
    return type.ref;
}
export function typeFromParam<Types extends SchemaTypes>(param: TypeParam<Types>, configStore: ConfigStore<Types>, nullableOption: FieldNullability<[
    unknown
]>): PothosOutputFieldType<Types> {
    const itemNullable = typeof nullableOption === "object" ? nullableOption.items : false;
    const nullable = typeof nullableOption === "object" ? nullableOption.list : !!nullableOption;
    if (Array.isArray(param)) {
        return {
            kind: "List",
            type: typeFromParam(param[0], configStore, itemNullable),
            nullable,
        };
    }
    if (param instanceof ListRef) {
        return {
            kind: "List",
            type: typeFromParam(param.listType as TypeParam<Types>, configStore, param.nullable),
            nullable,
        };
    }
    const ref = configStore.getOutputTypeRef(param);
    const kind = ref instanceof BaseTypeRef ? ref.kind : configStore.getTypeConfig(ref).graphqlKind;
    const name = ref instanceof BaseTypeRef ? ref.name : configStore.getTypeConfig(ref).name;
    if (kind !== "InputObject" && kind !== "List" && kind !== "InputList") {
        return {
            kind,
            ref,
            nullable,
        };
    }
    throw new PothosSchemaError(`Expected input param ${name} to be an output type but got ${kind}`);
}
export function unwrapInputFieldType<Types extends SchemaTypes>(type: PothosInputFieldType<Types>): InputType<Types> {
    if (type.kind === "List") {
        return unwrapInputFieldType(type.type);
    }
    return type.ref;
}
export function inputTypeFromParam<Types extends SchemaTypes>(param: InputTypeParam<Types>, configStore: ConfigStore<Types>, requiredOption: FieldRequiredness<[
    unknown
]>): PothosInputFieldType<Types> {
    const itemRequired = typeof requiredOption === "object" ? requiredOption.items : true;
    const required = typeof requiredOption === "object" ? requiredOption.list : !!requiredOption;
    if (Array.isArray(param)) {
        return {
            kind: "List",
            type: inputTypeFromParam(param[0], configStore, itemRequired),
            required,
        };
    }
    if (param instanceof InputListRef) {
        return {
            kind: "List",
            type: inputTypeFromParam(param.listType as InputTypeParam<Types>, configStore, param.required),
            required,
        };
    }
    const ref = configStore.getInputTypeRef(param);
    const kind = ref instanceof BaseTypeRef ? ref.kind : configStore.getTypeConfig(ref).graphqlKind;
    const name = ref instanceof BaseTypeRef ? ref.name : configStore.getTypeConfig(ref).name;
    if (kind === "InputObject" || kind === "Enum" || kind === "Scalar") {
        return {
            kind,
            ref,
            required,
        };
    }
    throw new PothosSchemaError(`Expected input param ${name} to be an InputObject, Enum, or Scalar but got ${kind}`);
}
