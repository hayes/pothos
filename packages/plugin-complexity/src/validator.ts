import { isThenable, PothosValidationError } from '@pothos/core';
import { type FragmentDefinitionNode, GraphQLError, Kind, type ValidationRule } from 'graphql';
import { complexityFromSelectionSet } from './calculate-complexity.js';
import { complexityVariableValues } from './variable-values.js';

export function createComplexityRule({
  variableValues,
  operationName,
  context,
  maxComplexity,
  maxBreadth,
  maxDepth,
  validate,
  onResult,
}: {
  context: object;
  variableValues: Record<string, unknown>;
  operationName?: string | null;
  maxComplexity?: number;
  maxDepth?: number;
  maxBreadth?: number;
  validate?: (
    result: { complexity: number; depth: number; breadth: number },
    reportError: (error: GraphQLError) => void,
  ) => void;
  onResult?: (
    result: { complexity: number; depth: number; breadth: number },
    errors: GraphQLError[],
  ) => void;
}) {
  const complexityValidationRule: ValidationRule = (validationContext) => {
    let state = {
      complexity: 0,
      depth: 0,
      breadth: 0,
    };

    let failed = false;
    const schema = validationContext.getSchema();
    const fragments: Record<string, FragmentDefinitionNode> = {};

    let operationCount = 0;
    let matchingOperation = false;
    for (const def of validationContext.getDocument().definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION) {
        fragments[def.name.value] = def;
      } else if (def.kind === Kind.OPERATION_DEFINITION) {
        operationCount += 1;
        matchingOperation ||= def.name?.value === operationName;
      }
    }

    if (operationName != null && !matchingOperation) {
      validationContext.reportError(
        new GraphQLError(`Unknown operation named "${operationName}".`),
      );
      return {};
    }

    return {
      OperationDefinition: {
        enter: (node) => {
          failed = operationName != null && node.name?.value !== operationName;
          if (failed) {
            return;
          }
          state = {
            complexity: 0,
            depth: 0,
            breadth: 0,
          };

          const type = schema.getRootType(node.operation);

          if (!type) {
            throw new PothosValidationError(
              `Could not find root type for operation ${node.operation}`,
            );
          }

          const variables = complexityVariableValues(
            schema,
            node.variableDefinitions ?? [],
            variableValues,
          );
          if ('errors' in variables) {
            failed = true;
            // Without an operation name, invalid variables may belong only to an
            // unselected operation. Execution will reject them if that operation is chosen.
            if (operationName != null || operationCount === 1) {
              for (const error of variables.errors) {
                validationContext.reportError(error);
              }
            }
            return;
          }

          try {
            const complexity = complexityFromSelectionSet(
              context,
              {
                fragments,
                variableValues: variables.variableValues,
                schema,
              },
              node.selectionSet,
              type,
            );

            if (isThenable(complexity)) {
              // GraphQL validation is synchronous. The calculation has already
              // started, so observe any rejection before reporting this limitation.
              Promise.resolve(complexity).catch(() => {});
              throw new PothosValidationError(
                'createComplexityRule does not support asynchronous complexity calculations; await complexityFromQuery before execution instead',
              );
            }

            state.complexity += complexity.complexity;
            state.depth = Math.max(state.depth, complexity.depth);
            state.breadth = Math.max(state.breadth, complexity.breadth);
          } catch (error) {
            if (!(error instanceof PothosValidationError)) {
              throw error;
            }
            failed = true;
            validationContext.reportError(error);
          }
        },
        leave: () => {
          if (failed) {
            return;
          }
          const errors: GraphQLError[] = [];
          const reportError = (error: GraphQLError) => {
            errors.push(error);
          };

          if (validate) {
            validate(state, (error) => {
              reportError(error);
            });
          } else {
            if (typeof maxComplexity === 'number' && state.complexity > maxComplexity) {
              reportError(
                new GraphQLError(
                  `Query complexity of ${state.complexity} exceeds max complexity of ${maxComplexity}`,
                  {
                    extensions: {
                      queryComplexity: {
                        max: maxComplexity,
                        actual: state.complexity,
                      },
                      code: 'QUERY_COMPLEXITY',
                    },
                  },
                ),
              );
            }

            if (typeof maxDepth === 'number' && state.depth > maxDepth) {
              reportError(
                new GraphQLError(`Query depth of ${state.depth} exceeds max depth of ${maxDepth}`, {
                  extensions: {
                    queryDepth: {
                      max: maxDepth,
                      actual: state.depth,
                    },
                    code: 'QUERY_DEPTH',
                  },
                }),
              );
            }

            if (typeof maxBreadth === 'number' && state.breadth > maxBreadth) {
              reportError(
                new GraphQLError(
                  `Query breadth of ${state.breadth} exceeds max breadth of ${maxBreadth}`,
                  {
                    extensions: {
                      queryBreadth: {
                        max: maxBreadth,
                        actual: state.breadth,
                      },
                      code: 'QUERY_BREADTH',
                    },
                  },
                ),
              );
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
