/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  FieldNode,
  FragmentDefinitionNode,
  getNamedType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNamedOutputType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  InlineFragmentNode,
  isOutputType,
  Kind,
  SelectionSetNode,
} from 'graphql';
import { getArgumentValues } from 'graphql/execution/values';
import { SchemaTypes } from '@giraphql/core';

import type { ComplexityResult, FieldComplexity, GiraphQLComplexityPlugin } from '.';

function isListType(type: GraphQLOutputType): boolean {
  if (type instanceof GraphQLList) {
    return true;
  }

  if (type instanceof GraphQLNonNull) {
    return isListType(type.ofType);
  }

  return false;
}

function complexityFromField<Types extends SchemaTypes>(
  plugin: GiraphQLComplexityPlugin<Types>,
  ctx: {},
  info: GraphQLResolveInfo,
  selection: FieldNode,
  type: GraphQLNamedOutputType,
): ComplexityResult {
  let depth = 1;
  let breadth = 1;
  if (!(type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType)) {
    throw new TypeError(`Expected Type ${type.name} to be an Object or Interface type`);
  }

  const field = type.getFields()[selection.name.value];

  if (!field) {
    throw new Error(field);
  }

  let complexityOption = field.extensions.complexity as FieldComplexity<{}, {}> | undefined;

  if (typeof complexityOption === 'function') {
    const args = getArgumentValues(field, selection, info.variableValues) as Record<
      string,
      unknown
    >;

    complexityOption = complexityOption(args, ctx);
  }

  let fieldMultiplier;

  if (typeof complexityOption === 'object' && complexityOption.multiplier !== undefined) {
    fieldMultiplier = complexityOption.multiplier;
  } else {
    fieldMultiplier = isListType(field.type) ? plugin.defaultListMultiplier : 1;
  }

  let complexity = 0;

  if (selection.selectionSet) {
    const subSelection = complexityFromSelectionSet(
      plugin,
      ctx,
      info,
      selection.selectionSet,
      getNamedType(field.type),
    );

    complexity += subSelection.complexity * fieldMultiplier;
    depth += subSelection.depth;
    breadth += subSelection.breadth;
  }

  complexity +=
    typeof complexityOption === 'number'
      ? complexityOption
      : complexityOption?.field ?? plugin.defaultComplexity;

  return { complexity, depth, breadth };
}

export function calculateComplexity<Types extends SchemaTypes>(
  plugin: GiraphQLComplexityPlugin<Types>,
  ctx: {},
  info: GraphQLResolveInfo,
) {
  const operationName = `${info.operation.operation
    .slice(0, 1)
    .toUpperCase()}${info.operation.operation.slice(1)}`;

  const operationType = info.schema.getType(operationName);

  if (!operationType || !isOutputType(operationType)) {
    throw new Error(`Unsupported operation ${operationName}`);
  }

  return complexityFromSelectionSet(plugin, ctx, info, info.operation.selectionSet, operationType);
}

function complexityFromFragment<Types extends SchemaTypes>(
  plugin: GiraphQLComplexityPlugin<Types>,
  ctx: {},
  info: GraphQLResolveInfo,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLNamedOutputType,
): ComplexityResult {
  const fragmentType = fragment.typeCondition
    ? info.schema.getType(fragment.typeCondition.name.value)
    : type;

  if (!isOutputType(fragmentType)) {
    throw new TypeError(`Expected Type ${type.name} to be an Output type`);
  }

  if (!fragmentType) {
    throw new Error(`Missing type from fragment ${fragment.typeCondition?.name.value}`);
  }

  return complexityFromSelectionSet(plugin, ctx, info, fragment.selectionSet, fragmentType);
}

function complexityFromSelectionSet<Types extends SchemaTypes>(
  plugin: GiraphQLComplexityPlugin<Types>,
  ctx: {},
  info: GraphQLResolveInfo,
  selectionSet: SelectionSetNode,
  type: GraphQLNamedOutputType,
): ComplexityResult {
  const result = {
    depth: 0,
    breadth: 0,
    complexity: 0,
  };

  for (const selection of selectionSet.selections) {
    let selectionResult;
    if (selection.kind === Kind.FIELD) {
      selectionResult = complexityFromField(plugin, ctx, info, selection, type);
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = info.fragments[selection.name.value];

      if (!fragment) {
        throw new Error(`Missing fragment ${selection.name.value}`);
      }

      selectionResult = complexityFromFragment(plugin, ctx, info, fragment, type);
    } else {
      selectionResult = complexityFromFragment(plugin, ctx, info, selection, type);
    }

    result.complexity += selectionResult.complexity;
    result.breadth += selectionResult.breadth;
    result.depth = Math.max(result.depth, selectionResult.depth);
  }

  return result;
}
