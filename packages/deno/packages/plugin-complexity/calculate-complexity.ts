// @ts-nocheck
import { FieldNode, FragmentDefinitionNode, getNamedType, GraphQLField, GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLOutputType, GraphQLResolveInfo, InlineFragmentNode, isInterfaceType, isObjectType, isOutputType, Kind, SelectionSetNode, } from 'https://cdn.skypack.dev/graphql?dts';
import { getArgumentValues } from 'https://cdn.skypack.dev/graphql/execution/values?dts';
import { DEFAULT_COMPLEXITY, DEFAULT_LIST_MULTIPLIER } from './defaults.ts';
import type { ComplexityResult, FieldComplexity } from './index.ts';
function isListType(type: GraphQLOutputType): boolean {
    if (type instanceof GraphQLList) {
        return true;
    }
    if (type instanceof GraphQLNonNull) {
        return isListType(type.ofType);
    }
    return false;
}
function complexityFromField(ctx: {}, info: PartialInfo, selection: FieldNode, type: GraphQLNamedType): ComplexityResult {
    let depth = 1;
    let breadth = 1;
    const fieldName = selection.name.value;
    const field = (isObjectType(type) || isInterfaceType(type)) && type.getFields()[fieldName]!;
    let complexityOption;
    if (field) {
        complexityOption = field.extensions?.complexity as FieldComplexity<{}, {}> | undefined;
    }
    else if (!fieldName.startsWith("__")) {
        throw new Error(`Unknown field selected (${type.name}.${fieldName})`);
    }
    if (typeof complexityOption === "function") {
        const args = getArgumentValues(field as GraphQLField<unknown, unknown>, selection, info.variableValues) as Record<string, unknown>;
        complexityOption = complexityOption(args, ctx);
    }
    let fieldMultiplier;
    if (typeof complexityOption === "object" && complexityOption.multiplier !== undefined) {
        fieldMultiplier = complexityOption.multiplier;
    }
    else {
        fieldMultiplier = field && isListType(field.type) ? DEFAULT_LIST_MULTIPLIER : 1;
    }
    let complexity = 0;
    if (field && selection.selectionSet) {
        const subSelection = complexityFromSelectionSet(ctx, info, selection.selectionSet, getNamedType(field.type));
        complexity += subSelection.complexity * fieldMultiplier;
        depth += subSelection.depth;
        breadth += subSelection.breadth;
    }
    complexity +=
        typeof complexityOption === "number"
            ? complexityOption
            : complexityOption?.field ?? DEFAULT_COMPLEXITY;
    return { complexity, depth, breadth };
}
export function calculateComplexity(ctx: {}, info: GraphQLResolveInfo) {
    const operationName = `${info.operation.operation
        .slice(0, 1)
        .toUpperCase()}${info.operation.operation.slice(1)}`;
    const operationType = info.schema.getType(operationName);
    if (!operationType || !isOutputType(operationType)) {
        throw new Error(`Unsupported operation ${operationName}`);
    }
    return complexityFromSelectionSet(ctx, info, info.operation.selectionSet, operationType);
}
interface PartialInfo {
    fragments: GraphQLResolveInfo["fragments"];
    variableValues: GraphQLResolveInfo["variableValues"];
    schema: GraphQLResolveInfo["schema"];
}
function complexityFromFragment(ctx: {}, info: PartialInfo, fragment: FragmentDefinitionNode | InlineFragmentNode, type: GraphQLNamedType): ComplexityResult {
    const fragmentType = fragment.typeCondition
        ? info.schema.getType(fragment.typeCondition.name.value)
        : type;
    if (!isOutputType(fragmentType)) {
        throw new TypeError(`Expected Type ${type.name} to be an Output type`);
    }
    if (!fragmentType) {
        throw new Error(`Missing type from fragment ${fragment.typeCondition?.name.value}`);
    }
    return complexityFromSelectionSet(ctx, info, fragment.selectionSet, fragmentType);
}
export function complexityFromSelectionSet(ctx: {}, info: PartialInfo, selectionSet: SelectionSetNode, type: GraphQLNamedType): ComplexityResult {
    const result = {
        depth: 0,
        breadth: 0,
        complexity: 0,
    };
    for (const selection of selectionSet.selections) {
        let selectionResult;
        if (selection.kind === Kind.FIELD) {
            selectionResult = complexityFromField(ctx, info, selection, type);
        }
        else if (selection.kind === Kind.FRAGMENT_SPREAD) {
            const fragment = info.fragments[selection.name.value];
            if (!fragment) {
                throw new Error(`Missing fragment ${selection.name.value}`);
            }
            selectionResult = complexityFromFragment(ctx, info, fragment, type);
        }
        else {
            selectionResult = complexityFromFragment(ctx, info, selection, type);
        }
        result.complexity += selectionResult.complexity;
        result.breadth += selectionResult.breadth;
        result.depth = Math.max(result.depth, selectionResult.depth);
    }
    return result;
}
