// @ts-nocheck
import { GraphQLNamedType, isEnumType, isInputObjectType, isInterfaceType, isObjectType, isScalarType, isUnionType, } from 'https://cdn.skypack.dev/graphql?dts';
import { createContextCache, SchemaTypes } from '../core/index.ts';
export const referencedTypes = createContextCache(() => new Set<GraphQLNamedType>());
export function addTypeToSchema<Types extends SchemaTypes>(builder: PothosSchemaTypes.SchemaBuilder<Types>, type: GraphQLNamedType) {
    if (builder.configStore.hasConfig(type.name as never)) {
        return;
    }
    if (isObjectType(type)) {
        builder.addGraphQLObject(type);
    }
    else if (isInterfaceType(type)) {
        builder.addGraphQLInterface(type);
    }
    else if (isUnionType(type)) {
        builder.addGraphQLUnion(type);
    }
    else if (isEnumType(type)) {
        builder.addGraphQLEnum(type);
    }
    else if (isInputObjectType(type)) {
        builder.addGraphQLInput(type);
    }
    else if (isScalarType(type)) {
        builder.addScalarType(type.name as never, type);
    }
}
export function addReferencedType<Types extends SchemaTypes>(builder: PothosSchemaTypes.SchemaBuilder<Types>, type: GraphQLNamedType) {
    if (referencedTypes(builder).has(type)) {
        return;
    }
    builder.configStore.onPrepare(() => void addTypeToSchema(builder, type));
}
