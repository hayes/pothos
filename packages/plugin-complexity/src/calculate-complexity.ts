import { getMappedArgumentValues, PothosValidationError } from '@pothos/core';
import {
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLField,
  GraphQLList,
  type GraphQLNamedType,
  GraphQLNonNull,
  type GraphQLOutputType,
  type GraphQLResolveInfo,
  getNamedType,
  type InlineFragmentNode,
  isInterfaceType,
  isObjectType,
  isOutputType,
  Kind,
  type SelectionSetNode,
} from 'graphql';
import type { ComplexityResult, FieldComplexity } from '.';
import { DEFAULT_COMPLEXITY, DEFAULT_LIST_MULTIPLIER } from './defaults';

function isListType(type: GraphQLOutputType): boolean {
  if (type instanceof GraphQLList) {
    return true;
  }

  if (type instanceof GraphQLNonNull) {
    return isListType(type.ofType);
  }

  return false;
}

function complexityFromField(
  ctx: object,
  info: PartialInfo,
  selection: FieldNode,
  type: GraphQLNamedType,
): ComplexityResult {
  let depth = 1;
  let breadth = 1;
  const fieldName = selection.name.value;

  const field = (isObjectType(type) || isInterfaceType(type)) && type.getFields()[fieldName]!;

  let complexityOption: FieldComplexity<object, object> | undefined;
  if (field) {
    complexityOption = field.extensions?.complexity as FieldComplexity<object, object> | undefined;
  } else if (!fieldName.startsWith('__')) {
    throw new PothosValidationError(`Unknown field selected (${type.name}.${fieldName})`);
  }

  if (typeof complexityOption === 'function') {
    const args = getMappedArgumentValues(
      field as GraphQLField<unknown, unknown>,
      selection,
      ctx,
      info,
    ) as Record<string, unknown>;

    complexityOption = complexityOption(args, ctx, field as GraphQLField<unknown, object, object>);
  }

  let fieldMultiplier: number;

  if (typeof complexityOption === 'object' && complexityOption.multiplier !== undefined) {
    fieldMultiplier = complexityOption.multiplier;
  } else {
    fieldMultiplier = field && isListType(field.type) ? DEFAULT_LIST_MULTIPLIER : 1;
  }

  let complexity = 0;

  if (field && selection.selectionSet) {
    const subSelection = complexityFromSelectionSet(
      ctx,
      info,
      selection.selectionSet,
      getNamedType(field.type),
    );

    complexity += subSelection.complexity * Math.max(fieldMultiplier, 0);
    depth += subSelection.depth;
    breadth += subSelection.breadth;
  }

  complexity +=
    typeof complexityOption === 'number'
      ? complexityOption
      : (complexityOption?.field ?? DEFAULT_COMPLEXITY);

  return { complexity, depth, breadth };
}

export function calculateComplexity(ctx: object, info: GraphQLResolveInfo) {
  const operationName = `${info.operation.operation
    .slice(0, 1)
    .toUpperCase()}${info.operation.operation.slice(1)}`;

  const operationType = info.schema.getType(operationName);

  if (!operationType || !isOutputType(operationType)) {
    throw new PothosValidationError(`Unsupported operation ${operationName}`);
  }

  return complexityFromSelectionSet(ctx, info, info.operation.selectionSet, operationType);
}

interface PartialInfo {
  fragments: GraphQLResolveInfo['fragments'];
  variableValues: GraphQLResolveInfo['variableValues'];
  schema: GraphQLResolveInfo['schema'];
}

function complexityFromFragment(
  ctx: object,
  info: PartialInfo,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLNamedType,
): ComplexityResult {
  const fragmentType = fragment.typeCondition
    ? info.schema.getType(fragment.typeCondition.name.value)
    : type;

  if (!isOutputType(fragmentType)) {
    throw new PothosValidationError(`Expected Type ${type.name} to be an Output type`);
  }

  if (!fragmentType) {
    throw new PothosValidationError(
      `Missing type from fragment ${fragment.typeCondition?.name.value}`,
    );
  }

  return complexityFromSelectionSet(ctx, info, fragment.selectionSet, fragmentType);
}

export function complexityFromSelectionSet(
  ctx: object,
  info: PartialInfo,
  selectionSet: SelectionSetNode,
  type: GraphQLNamedType,
): ComplexityResult {
  const result = {
    depth: 0,
    breadth: 0,
    complexity: 0,
  };

  for (const selection of selectionSet.selections) {
    let selectionResult: ComplexityResult;
    if (selection.kind === Kind.FIELD) {
      selectionResult = complexityFromField(ctx, info, selection, type);
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = info.fragments[selection.name.value];

      if (!fragment) {
        throw new PothosValidationError(`Missing fragment ${selection.name.value}`);
      }

      selectionResult = complexityFromFragment(ctx, info, fragment, type);
    } else {
      selectionResult = complexityFromFragment(ctx, info, selection, type);
    }

    result.complexity += selectionResult.complexity;
    result.breadth += selectionResult.breadth;
    result.depth = Math.max(result.depth, selectionResult.depth);
  }

  return result;
}
