import {
  GraphQLIncludeDirective,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  getDirectiveValues,
  Kind,
  type SelectionNode,
  type SelectionSetNode,
} from 'graphql';

export function selectionIncludesField(info: GraphQLResolveInfo, fieldName: string): boolean {
  return selectionSetIncludesField(info.fieldNodes[0]?.selectionSet, fieldName, info);
}

export function selectionSetIncludesField(
  selectionSet: SelectionSetNode | undefined,
  fieldName: string,
  info: GraphQLResolveInfo,
): boolean {
  // Visited set guards against fragment cycles for callers that bypass
  // GraphQL.js's `NoFragmentCyclesRule` (persisted queries / custom
  // executors that skip `validate`).
  return walk(selectionSet, fieldName, info, new Set());
}

function walk(
  selectionSet: SelectionSetNode | undefined,
  fieldName: string,
  info: GraphQLResolveInfo,
  visited: Set<string>,
): boolean {
  if (!selectionSet) {
    return false;
  }
  for (const sel of selectionSet.selections) {
    if (isSkipped(sel, info)) {
      continue;
    }
    if (sel.kind === Kind.FIELD) {
      if (sel.name.value === fieldName) {
        return true;
      }
      continue;
    }
    if (sel.kind === Kind.INLINE_FRAGMENT) {
      if (walk(sel.selectionSet, fieldName, info, visited)) {
        return true;
      }
      continue;
    }
    if (sel.kind === Kind.FRAGMENT_SPREAD) {
      const name = sel.name.value;
      if (visited.has(name)) {
        continue;
      }
      const fragment = info.fragments[name];
      if (!fragment) {
        continue;
      }
      visited.add(name);
      const hit = walk(fragment.selectionSet, fieldName, info, visited);
      visited.delete(name);
      if (hit) {
        return true;
      }
    }
  }
  return false;
}

function isSkipped(sel: SelectionNode, info: GraphQLResolveInfo): boolean {
  // Short-circuit the common no-directives case — `getDirectiveValues`
  // allocates per call.
  if (!sel.directives?.length) {
    return false;
  }
  const skip = getDirectiveValues(GraphQLSkipDirective, sel, info.variableValues);
  if (skip?.if === true) {
    return true;
  }
  const include = getDirectiveValues(GraphQLIncludeDirective, sel, info.variableValues);
  if (include?.if === false) {
    return true;
  }
  return false;
}
