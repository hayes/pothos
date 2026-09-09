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

// Assumes the operation has passed GraphQL.js validation. Cyclic
// fragments are rejected by the `NoFragmentCycles` rule before
// execution reaches this code.
export function selectionSetIncludesField(
  selectionSet: SelectionSetNode | undefined,
  fieldName: string,
  info: GraphQLResolveInfo,
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
      if (selectionSetIncludesField(sel.selectionSet, fieldName, info)) {
        return true;
      }
      continue;
    }
    if (sel.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = info.fragments[sel.name.value];
      if (fragment && selectionSetIncludesField(fragment.selectionSet, fieldName, info)) {
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
