import { FragmentDefinitionNode, GraphQLError, Kind, ValidationRule } from 'graphql';
import { complexityFromSelectionSet } from './calculate-complexity';

export function createComplexityRule({
  variableValues,
  context,
  maxComplexity,
  maxBreadth,
  maxDepth,
}: {
  context: object;
  variableValues: Record<string, unknown>;
  maxComplexity?: number;
  maxDepth?: number;
  maxBreadth?: number;
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
            throw new Error(`Could not find root type for operation ${node.operation}`);
          }

          const complexity = complexityFromSelectionSet(
            context,
            {
              fragments,
              variableValues,
              schema,
            },
            node.selectionSet,
            type,
          );

          state.complexity += complexity.complexity;
          state.depth = Math.max(state.depth, complexity.depth);
          state.breadth = Math.max(state.breadth, complexity.breadth);
        },
        leave: () => {
          if (maxComplexity && state.complexity > maxComplexity) {
            validationContext.reportError(
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

          if (maxDepth && state.depth > maxDepth) {
            validationContext.reportError(
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

          if (maxBreadth && state.breadth > maxBreadth) {
            validationContext.reportError(
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
        },
      },
    };
  };

  return complexityValidationRule;
}
