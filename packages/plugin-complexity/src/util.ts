import { type MaybePromise, PothosValidationError } from '@pothos/core';
import {
  type DocumentNode,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  Kind,
  type OperationDefinitionNode,
  parse,
} from 'graphql';
import { complexityFromSelectionSet } from './calculate-complexity.js';
import type { ComplexityResult } from './types.js';
import { complexityVariableValues } from './variable-values.js';

export function complexityFromQuery(
  query: DocumentNode | string,
  options: {
    schema: GraphQLSchema;
    ctx?: object;
    variables?: Record<string, unknown>;
  },
): MaybePromise<ComplexityResult> {
  const parsedQuery = typeof query === 'string' ? parse(query) : query;

  const operation = parsedQuery.definitions.find(
    (def) => def.kind === Kind.OPERATION_DEFINITION,
  ) as OperationDefinitionNode;

  if (!operation) {
    throw new PothosValidationError('No operation found');
  }

  const fragments = parsedQuery.definitions.reduce<GraphQLResolveInfo['fragments']>(
    (fragments, def) => {
      if (def.kind === Kind.FRAGMENT_DEFINITION) {
        fragments[def.name.value] = def;
      }

      return fragments;
    },
    {},
  );

  const rootType = options.schema.getRootType(operation.operation);

  if (!rootType) {
    throw new PothosValidationError(`No root type found for operation ${operation.operation}`);
  }

  const variables = complexityVariableValues(
    options.schema,
    operation.variableDefinitions ?? [],
    options.variables ?? {},
  );

  if ('errors' in variables) {
    throw variables.errors[0];
  }

  const info = {
    schema: options.schema,
    fragments,
    variableValues: variables.variableValues,
  };

  return complexityFromSelectionSet(options.ctx ?? {}, info, operation.selectionSet, rootType);
}
