// @ts-nocheck
import { PothosOutputFieldConfig, PothosOutputFieldType, SchemaTypes } from '../core/index.ts';
export function isRootField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
    return (config.parentType === "Query" ||
        config.parentType === "Mutation" ||
        config.parentType === "Subscription");
}
export function resolveFieldType<Types extends SchemaTypes>(type: PothosOutputFieldType<Types>): "Enum" | "Interface" | "Object" | "Scalar" | "Union" {
    if (type.kind === "List") {
        return resolveFieldType(type.type);
    }
    return type.kind;
}
export function isScalarField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
    return resolveFieldType(config.type) === "Scalar";
}
export function isEnumField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
    return resolveFieldType(config.type) === "Enum";
}
