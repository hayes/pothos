import { type GraphQLResolveInfo, versionInfo } from 'graphql';

// graphql 16 and 17 disagree on the shape of `GraphQLResolveInfo['variableValues']`, which is the
// value `getArgumentValues` reads when resolving field arguments:
//   - graphql 16: a flat `{ [variableName]: coercedValue }` map
//   - graphql 17: `{ sources, coerced }`, where the coerced map lives under `.coerced`
// The complexity plugin builds a synthetic resolve-info (it inspects queries without executing
// them), so it has to produce whichever shape the installed graphql version expects. The cast is
// required because the static type only ever reflects one major at a time.
export function asVariableValues(
  coerced: Record<string, unknown>,
): GraphQLResolveInfo['variableValues'] {
  if (versionInfo.major >= 17) {
    return { sources: {}, coerced } as unknown as GraphQLResolveInfo['variableValues'];
  }

  return coerced as unknown as GraphQLResolveInfo['variableValues'];
}
