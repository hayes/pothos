// @ts-nocheck
import { PothosValidationError } from '../core/index.ts';
import { type DocumentNode, type GraphQLResolveInfo, type GraphQLSchema, Kind, type OperationDefinitionNode, parse, } from 'https://cdn.skypack.dev/graphql?dts';
import { complexityFromSelectionSet } from './calculate-complexity.ts';
export function complexityFromQuery(query: DocumentNode | string, options: {
    schema: GraphQLSchema;
    ctx?: object;
    variables?: Record<string, unknown>;
}) {
    const parsedQuery = typeof query === "string" ? parse(query) : query;
    const operation = parsedQuery.definitions.find((def) => def.kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode;
    if (!operation) {
        throw new PothosValidationError("No operation found");
    }
    const fragments = parsedQuery.definitions.reduce<GraphQLResolveInfo["fragments"]>((fragments, def) => {
        if (def.kind === Kind.FRAGMENT_DEFINITION) {
            fragments[def.name.value] = def;
        }
        return fragments;
    }, {});
    const rootType = options.schema.getType(operation.operation.slice(0, 1).toUpperCase() + operation.operation.slice(1));
    if (!rootType) {
        throw new PothosValidationError(`No root type found for operation ${operation.operation}`);
    }
    const info = {
        schema: options.schema,
        fragments,
        variableValues: options.variables ?? {},
    };
    return complexityFromSelectionSet(options.ctx ?? {}, info, operation.selectionSet, rootType);
}
