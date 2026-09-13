import {
  type GraphQLError,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  getVariableValues,
  type VariableDefinitionNode,
  versionInfo,
} from 'graphql';

export function complexityVariableValues(
  schema: GraphQLSchema,
  definitions: readonly VariableDefinitionNode[],
  inputs: Record<string, unknown>,
): { errors: readonly GraphQLError[] } | { variableValues: GraphQLResolveInfo['variableValues'] } {
  const result = getVariableValues(schema, definitions, inputs);

  if (result.errors) {
    return { errors: result.errors };
  }

  // GraphQL 16 returns a flat coerced map; GraphQL 17 returns values with source metadata.
  return {
    variableValues:
      versionInfo.major >= 17
        ? (result as unknown as { variableValues: GraphQLResolveInfo['variableValues'] })
            .variableValues
        : (result as unknown as { coerced: GraphQLResolveInfo['variableValues'] }).coerced,
  };
}
