import { PothosValidationError } from '@pothos/core';
import {
  doTypesOverlap,
  type FieldNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  type GraphQLField,
  GraphQLIncludeDirective,
  type GraphQLNamedType,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  GraphQLSkipDirective,
  getDirectiveValues,
  getNamedType,
  type InlineFragmentNode,
  isAbstractType,
  isInterfaceType,
  isObjectType,
  Kind,
} from 'graphql';

export interface IndirectPathSegment {
  type?: string;
  name: string;
}

export type PathSegment = string | IndirectPathSegment;

/**
 * Set on a type's extensions (by the errors plugin, or by hand) to say that a selection on the
 * type is really a selection on `getType()`, found under `path` (or any of `paths`).
 */
export interface IndirectInclude {
  getType: () => string;
  path?: IndirectPathSegment[];
  paths?: IndirectPathSegment[][];
}

export interface Match {
  /** The GraphQL type of the matched field's return type */
  type: GraphQLNamedType;
  field: FieldNode;
  /** Aliased field names from the starting selection to the matched field */
  path: string[];
  deferred: boolean;
}

export interface MatchOptions<M> {
  /** A type-level path prepended to every path. */
  prefix?: IndirectPathSegment[];
  /** The alias path the returned matches' paths start with. */
  path?: string[];
  deferred?: boolean;
  /**
   * W-10: matches whose field returns a different model than `targetType` are dropped. Several
   * implementations of an interface may share a field name while returning different models, and
   * their selections must never be merged into the same query. Types without a model always
   * match. `modelOf` resolves a type's model through any indirect include.
   */
  targetType?: GraphQLNamedType;
  modelOf?: (type: GraphQLNamedType) => M | undefined;
}

/** The include a type carries, if any. */
export function includeOf(type: GraphQLNamedType): IndirectInclude | undefined {
  return type.extensions?.pothosIndirectInclude as IndirectInclude | undefined;
}

/** Follows `pothosIndirectInclude.getType()` until a type without one. */
export function resolveType(schema: GraphQLSchema, type: GraphQLNamedType): GraphQLNamedType {
  let target = type;
  let include = includeOf(target);

  while (include) {
    target = schema.getType(include.getType())!;
    include = includeOf(target);
  }

  return target;
}

/**
 * Finds every field selected at the end of one of `paths`, starting from `selection` (which is
 * expected to be a selection on `type`). Paths are followed through fragments; see
 * `resolveFragmentTypes` for the rules. Matches are returned in path order, then document order.
 */
export function findMatches<M>(
  info: GraphQLResolveInfo,
  type: GraphQLNamedType,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  paths: IndirectPathSegment[][],
  { prefix, path = [], deferred = false, targetType, modelOf }: MatchOptions<M> = {},
): Match[] {
  const matches: Match[] = [];

  for (const includePath of paths) {
    walkIndirectPath(
      type,
      type,
      info,
      selection,
      prefix && prefix.length > 0 ? [...prefix, ...includePath] : includePath,
      path,
      deferred,
      matches,
    );
  }

  const targetModel = targetType && modelOf?.(targetType);

  if (!targetModel) {
    return matches;
  }

  return matches.filter((match) => {
    const model = modelOf!(match.type);

    return !model || model === targetModel;
  });
}

/**
 * The nodes selecting the field being resolved, seen through any wrapper on its return type (an
 * errors plugin result, for instance). Under a wrapper these are the nodes of the wrapped field,
 * so their selection sets apply to the type `resolveType` resolves to.
 */
export function selectedFieldNodes(info: GraphQLResolveInfo): FieldNode[] {
  const returnType = getNamedType(info.returnType);
  const prefix = includeOf(returnType)?.path;

  return info.fieldNodes.flatMap((node) =>
    findMatches(info, returnType, node, [[]], { prefix }).map((match) => match.field),
  );
}

/**
 * Recursive step of `findMatches`.
 *
 * `type` is the type of the selection set being walked. `expectedType` is the type the next path
 * segment must be selected on: a field only matches while the two are the same, which is what
 * prevents a same-named field under an unrelated fragment from matching.
 */
function walkIndirectPath(
  type: GraphQLNamedType,
  expectedType: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  includePath: IndirectPathSegment[],
  path: string[],
  deferred: boolean,
  matches: Match[],
) {
  if (includePath.length === 0) {
    matches.push({ type, field: selection as FieldNode, path, deferred });
    return;
  }

  if (!selection.selectionSet) {
    return;
  }

  const [include, ...rest] = includePath;

  for (const sel of selection.selectionSet.selections) {
    switch (sel.kind) {
      case Kind.FIELD: {
        if (
          expectedType.name === type.name &&
          sel.name.value === include.name &&
          (isObjectType(type) || isInterfaceType(type)) &&
          !isSkipped(info, sel)
        ) {
          const returnType = getNamedType(type.getFields()[sel.name.value].type);

          walkIndirectPath(
            returnType,
            returnType,
            info,
            sel,
            rest,
            [...path, sel.alias?.value ?? sel.name.value],
            deferred,
            matches,
          );
        }
        continue;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragment = info.fragments[sel.name.value];
        const next = resolveFragmentTypes(
          info,
          info.schema.getType(fragment.typeCondition.name.value)!,
          type,
          expectedType,
          include,
        );

        walkIndirectPath(
          next.type,
          next.expectedType,
          info,
          fragment,
          includePath,
          path,
          deferred || isDeferred(info, sel),
          matches,
        );
        continue;
      }
      case Kind.INLINE_FRAGMENT: {
        const next = resolveFragmentTypes(
          info,
          sel.typeCondition ? info.schema.getType(sel.typeCondition.name.value)! : undefined,
          type,
          expectedType,
          include,
        );

        walkIndirectPath(
          next.type,
          next.expectedType,
          info,
          sel,
          includePath,
          path,
          deferred || isDeferred(info, sel),
          matches,
        );
        continue;
      }
      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(sel as { kind: string }).kind}`,
        );
    }
  }
}

/**
 * Determines the type to walk and the type the next segment is expected on when descending into a
 * fragment.
 *
 * - A segment with an explicit `type` pins the expected type.
 * - A fragment on the expected type, or on an abstract type the expected type belongs to, walks as
 *   the expected type: every field selectable there also exists on it.
 * - A fragment that narrows an abstract expected type to an implementation or member, or to an
 *   abstract type that overlaps it, advances the expected type so the segment's field can be found
 *   on the narrower type.
 * - Fragments on unrelated types keep the expected type, so their fields are skipped until a nested
 *   fragment narrows back to it.
 */
function resolveFragmentTypes(
  info: GraphQLResolveInfo,
  fragmentType: GraphQLNamedType | undefined,
  type: GraphQLNamedType,
  expectedType: GraphQLNamedType,
  include: IndirectPathSegment,
) {
  let expected = expectedType;

  if (include.type) {
    const pinned = info.schema.getType(include.type);

    if (!pinned) {
      throw new PothosValidationError(
        `Unknown type ${include.type} in indirect include path segment ${include.name}`,
      );
    }

    expected = pinned;
  }

  if (!fragmentType || fragmentType.name === expected.name) {
    return { type: fragmentType ?? type, expectedType: expected };
  }

  if (
    isAbstractType(fragmentType) &&
    (isObjectType(expected) || isInterfaceType(expected)) &&
    info.schema.isSubType(fragmentType, expected)
  ) {
    return { type: expected, expectedType: expected };
  }

  if (isAbstractType(expected)) {
    const narrows =
      isObjectType(fragmentType) || isInterfaceType(fragmentType)
        ? info.schema.isSubType(expected, fragmentType)
        : false;
    const overlaps =
      isAbstractType(fragmentType) && doTypesOverlap(info.schema, expected, fragmentType);

    if (narrows || overlaps) {
      return { type: fragmentType, expectedType: fragmentType };
    }
  }

  return { type: fragmentType, expectedType: expected };
}

/**
 * Turns a plain string path handed to `nestedSelection` into an include. Segments intentionally
 * omit `type`: a segment `type` pins the fragment type condition the field must be found under,
 * which is not known for a plain string path. The walker narrows through fragments on its own.
 */
export function normalizeInclude(
  path: string[],
  type: GraphQLNamedType,
  expectedType?: GraphQLNamedType,
): IndirectInclude {
  let currentType = path.length > 0 ? type : (expectedType ?? type);

  const normalized: { name: string }[] = [];

  if (!(isObjectType(currentType) || isInterfaceType(currentType))) {
    throw new PothosValidationError(`Expected ${currentType} to be an Object type`);
  }

  for (const fieldName of path) {
    const field: GraphQLField<unknown, unknown> = currentType.getFields()[fieldName];

    if (!field) {
      throw new PothosValidationError(`Expected ${currentType} to have a field ${fieldName}`);
    }

    currentType = getNamedType(field.type);

    if (!(isObjectType(currentType) || isInterfaceType(currentType))) {
      throw new PothosValidationError(`Expected ${currentType} to be an Object or Interface type`);
    }

    normalized.push({ name: fieldName });
  }

  const targetType = currentType;

  return {
    getType: () => expectedType?.name ?? targetType.name,
    path: normalized,
  };
}

/** S-2: a field under `@skip(if: true)` or `@include(if: false)`. */
export function isSkipped(info: GraphQLResolveInfo, selection: FieldNode) {
  const skip = getDirectiveValues(GraphQLSkipDirective, selection, info.variableValues);
  if (skip?.if === true) {
    return true;
  }

  const include = getDirectiveValues(GraphQLIncludeDirective, selection, info.variableValues);
  if (include?.if === false) {
    return true;
  }

  return false;
}

/** S-8: a fragment under `@defer` (when the schema declares the directive). */
export function isDeferred(
  info: GraphQLResolveInfo,
  node: FragmentSpreadNode | InlineFragmentNode,
) {
  const deferDirective = info.schema.getDirective('defer');
  if (!deferDirective) {
    return false;
  }

  const defer = getDirectiveValues(deferDirective, node, info.variableValues);
  return !!defer && defer.if !== false;
}
