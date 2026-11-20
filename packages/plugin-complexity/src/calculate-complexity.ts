import {
  completeValue,
  getMappedArgumentValues,
  isThenable,
  type MaybePromise,
  PothosValidationError,
} from '@pothos/core';
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
import { DEFAULT_COMPLEXITY, DEFAULT_LIST_MULTIPLIER } from './defaults.js';
import type { ComplexityResult, FieldComplexity, FieldComplexityValue } from './index.js';

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
  traversal: Traversal,
): MaybePromise<ComplexityResult> {
  const fieldName = selection.name.value;
  const field = (isObjectType(type) || isInterfaceType(type)) && type.getFields()[fieldName]!;
  let complexityOption: FieldComplexity<object, object> | undefined;
  if (field) {
    complexityOption = field.extensions?.complexity as FieldComplexity<object, object> | undefined;
  } else if (!fieldName.startsWith('__')) {
    throw new PothosValidationError(`Unknown field selected (${type.name}.${fieldName})`);
  }

  const complexityValue =
    typeof complexityOption === 'function'
      ? completeValue(
          getMappedArgumentValues(field as GraphQLField<unknown, unknown>, selection, ctx, info),
          (args) => complexityOption(args, ctx, field as GraphQLField<unknown, object, object>),
        )
      : complexityOption;

  return completeValue(complexityValue, (option: FieldComplexityValue | undefined) => {
    const multiplier =
      typeof option === 'object' && option.multiplier !== undefined
        ? option.multiplier
        : field && isListType(field.type)
          ? DEFAULT_LIST_MULTIPLIER
          : 1;
    const fieldComplexity =
      typeof option === 'number' ? option : (option?.field ?? DEFAULT_COMPLEXITY);
    const subSelection =
      field && selection.selectionSet
        ? complexityFromSelectionSet(
            ctx,
            info,
            selection.selectionSet,
            getNamedType(field.type),
            traversal,
          )
        : { complexity: 0, depth: 0, breadth: 0 };

    return completeValue(subSelection, (children) => ({
      complexity:
        fieldComplexity +
        (field && selection.selectionSet ? children.complexity * Math.max(multiplier, 0) : 0),
      depth: 1 + children.depth,
      breadth: 1 + children.breadth,
    }));
  });
}

export function calculateComplexity(ctx: object, info: GraphQLResolveInfo) {
  const operationType = info.schema.getRootType(info.operation.operation);

  if (!operationType || !isOutputType(operationType)) {
    throw new PothosValidationError(`Unsupported operation ${info.operation.operation}`);
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
  traversal: Traversal,
): MaybePromise<ComplexityResult> {
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

  return complexityFromSelectionSet(ctx, info, fragment.selectionSet, fragmentType, traversal);
}

interface Traversal {
  active: Set<SelectionSetNode>;
  results: Map<SelectionSetNode, Map<GraphQLNamedType, ComplexityResult>>;
}

export function complexityFromSelectionSet(
  ctx: object,
  info: PartialInfo,
  selectionSet: SelectionSetNode,
  type: GraphQLNamedType,
  traversal: Traversal = { active: new Set(), results: new Map() },
): MaybePromise<ComplexityResult> {
  const cached = traversal.results.get(selectionSet)?.get(type);

  if (cached) {
    return cached;
  }

  if (traversal.active.has(selectionSet)) {
    throw new PothosValidationError('Cannot calculate complexity of a cyclic fragment');
  }

  traversal.active.add(selectionSet);
  const result = {
    depth: 0,
    breadth: 0,
    complexity: 0,
  };

  function addSelection(selectionResult: ComplexityResult) {
    result.complexity += selectionResult.complexity;
    result.breadth += selectionResult.breadth;
    result.depth = Math.max(result.depth, selectionResult.depth);
  }

  function next(index: number): MaybePromise<ComplexityResult> {
    for (let i = index; i < selectionSet.selections.length; i += 1) {
      const selection = selectionSet.selections[i];
      let selectionResult: MaybePromise<ComplexityResult>;
      if (selection.kind === Kind.FIELD) {
        selectionResult = complexityFromField(ctx, info, selection, type, traversal);
      } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragment = info.fragments[selection.name.value];
        if (!fragment) {
          throw new PothosValidationError(`Missing fragment ${selection.name.value}`);
        }
        selectionResult = complexityFromFragment(ctx, info, fragment, type, traversal);
      } else {
        selectionResult = complexityFromFragment(ctx, info, selection, type, traversal);
      }

      if (isThenable(selectionResult)) {
        // Finish this branch before visiting its siblings so active paths remain
        // ancestry paths, and shared fragments can reuse completed results.
        return completeValue(selectionResult, (completed) => {
          addSelection(completed);
          return next(i + 1);
        });
      }
      addSelection(selectionResult);
    }
    return result;
  }

  try {
    return completeValue(
      next(0),
      (completed) => {
        traversal.active.delete(selectionSet);
        if (!traversal.results.has(selectionSet)) {
          traversal.results.set(selectionSet, new Map());
        }
        traversal.results.get(selectionSet)!.set(type, completed);
        return completed;
      },
      (error) => {
        traversal.active.delete(selectionSet);
        throw error;
      },
    );
  } catch (error) {
    traversal.active.delete(selectionSet);
    throw error;
  }
}
