// @ts-nocheck
import { FragmentDefinitionNode, GraphQLError, Kind, ValidationRule } from 'https://cdn.skypack.dev/graphql?dts';
import { PothosValidationError } from '../core/index.ts';
import { complexityFromSelectionSet } from './calculate-complexity.ts';
export function createComplexityRule({ variableValues, context, maxComplexity, maxBreadth, maxDepth, validate, onResult, }: {
    context: object;
    variableValues: Record<string, unknown>;
    maxComplexity?: number;
    maxDepth?: number;
    maxBreadth?: number;
    validate?: (result: {
        complexity: number;
        depth: number;
        breadth: number;
    }, reportError: (error: GraphQLError) => void) => void;
    onResult?: (result: {
        complexity: number;
        depth: number;
        breadth: number;
    }, errors: GraphQLError[]) => void;
}) {
    const complexityValidationRule: ValidationRule = (validationContext) => {
        const state = {
            complexity: 0,
            depth: 0,
            breadth: 0,
        };
        const schema = validationContext.getSchema();
        const fragments: Record<string, FragmentDefinitionNode> = {};
        validationContext.getDocument().definitions.forEach((def) => {
            if (def.kind === Kind.FRAGMENT_DEFINITION) {
                fragments[def.name.value] = def;
            }
        });
        return {
            OperationDefinition: {
                enter: (node) => {
                    const type = schema.getRootType(node.operation);
                    if (!type) {
                        throw new PothosValidationError(`Could not find root type for operation ${node.operation}`);
                    }
                    const complexity = complexityFromSelectionSet(context, {
                        fragments,
                        variableValues,
                        schema,
                    }, node.selectionSet, type);
                    state.complexity += complexity.complexity;
                    state.depth = Math.max(state.depth, complexity.depth);
                    state.breadth = Math.max(state.breadth, complexity.breadth);
                },
                leave: () => {
                    const errors: GraphQLError[] = [];
                    const reportError = (error: GraphQLError) => {
                        errors.push(error);
                    };
                    if (validate) {
                        validate(state, (error) => {
                            reportError(error);
                        });
                    }
                    else {
                        if (maxComplexity && state.complexity > maxComplexity) {
                            reportError(new GraphQLError(`Query complexity of ${state.complexity} exceeds max complexity of ${maxComplexity}`, {
                                extensions: {
                                    queryComplexity: {
                                        max: maxComplexity,
                                        actual: state.complexity,
                                    },
                                    code: "QUERY_COMPLEXITY",
                                },
                            }));
                        }
                        if (maxDepth && state.depth > maxDepth) {
                            reportError(new GraphQLError(`Query depth of ${state.depth} exceeds max depth of ${maxDepth}`, {
                                extensions: {
                                    queryDepth: {
                                        max: maxDepth,
                                        actual: state.depth,
                                    },
                                    code: "QUERY_DEPTH",
                                },
                            }));
                        }
                        if (maxBreadth && state.breadth > maxBreadth) {
                            reportError(new GraphQLError(`Query breadth of ${state.breadth} exceeds max breadth of ${maxBreadth}`, {
                                extensions: {
                                    queryBreadth: {
                                        max: maxBreadth,
                                        actual: state.breadth,
                                    },
                                    code: "QUERY_BREADTH",
                                },
                            }));
                        }
                    }
                    for (const error of errors) {
                        validationContext.reportError(error);
                    }
                    onResult?.(state, errors);
                },
            },
        };
    };
    return complexityValidationRule;
}
