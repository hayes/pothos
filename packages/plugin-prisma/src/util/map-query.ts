import { getMappedArgumentValues, PothosValidationError } from '@pothos/core';
import {
  doTypesOverlap,
  type FieldNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  type GraphQLField,
  GraphQLIncludeDirective,
  type GraphQLInterfaceType,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  getDirectiveValues,
  getNamedType,
  type InlineFragmentNode,
  isAbstractType,
  isInterfaceType,
  isObjectType,
  Kind,
  type SelectionSetNode,
} from 'graphql';
import type {
  FieldSelection,
  IncludeMap,
  IndirectInclude,
  LoaderMappings,
  SelectionMap,
} from '../types.js';
import { setLoaderMappings } from './loader-map.js';
import type { FieldMap } from './relation-map.js';
import {
  createState,
  mergeSelection,
  type SelectionState,
  selectionCompatible,
  selectionToQuery,
} from './selections.js';
import { wrapWithUsageCheck } from './usage.js';

/**
 * Plans `selection` (a field node) against `type`. `declaredType` is the named return type of the
 * field the selection set belongs to; it differs from `type` when a walk is pinned to another
 * type (a `typeName`, or an expected type handed to a nested selection), and decides whether
 * fragments on other object types of the same model can apply (see `typeForFragment`).
 */
function addTypeSelectionsForField(
  type: GraphQLNamedType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
  deferred?: boolean,
  declaredType: GraphQLNamedType = type,
) {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const { pothosIndirectInclude, pothosPrismaModel } = (type.extensions ?? {}) as {
    pothosIndirectInclude?: IndirectInclude;
    pothosPrismaModel?: string;
  };

  if (
    (!!pothosIndirectInclude?.path && pothosIndirectInclude.path.length > 0) ||
    (!!pothosIndirectInclude?.paths && pothosIndirectInclude.paths.length > 0)
  ) {
    const matches = findIndirectSelections(
      type,
      info,
      selection,
      pothosIndirectInclude.paths ?? [pothosIndirectInclude.path!],
      { path: indirectPath },
    );

    for (const match of matches) {
      addTypeSelectionsForField(
        match.type,
        context,
        info,
        state,
        match.field,
        match.path,
        match.deferred,
      );
    }

    // The wrapper's own selection is planned only when the wrapper itself is backed by the model
    // being queried (a variant that also points at a nested field). A plain wrapper, or one backed
    // by another model, has nothing of its own to add to this query.
    if (pothosPrismaModel !== state.fieldMap.model) {
      return;
    }
  } else if (pothosIndirectInclude) {
    addTypeSelectionsForField(
      info.schema.getType(pothosIndirectInclude.getType())!,
      context,
      info,
      state,
      selection,
      indirectPath,
      deferred,
      declaredType,
    );
    return;
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return;
  }

  applyTypeSelection(type, state);

  if (selection.selectionSet && (!deferred || !state.skipDeferredFragments)) {
    addNestedSelections(
      type,
      context,
      info,
      state,
      selection.selectionSet,
      indirectPath,
      isAbstractType(declaredType),
    );
  }
}

/**
 * Merges a type's own type-level selection into `state`. A model type without a `select` is an
 * include-mode type, so it flips the state to include mode; a `select` or `include` on the type is
 * merged as-is.
 *
 * With `compatibleOnly`, relations and counts whose type-level arguments conflict with what
 * `state` already selects are left out instead of replacing it.
 */
function applyTypeSelection(
  type: GraphQLNamedType,
  state: SelectionState,
  { compatibleOnly = false } = {},
) {
  const { pothosPrismaSelect, pothosPrismaModel } = (type.extensions ?? {}) as {
    pothosPrismaModel?: string;
    pothosPrismaSelect?: IncludeMap;
  };

  if (pothosPrismaModel && !pothosPrismaSelect) {
    state.mode = 'include';
  }

  const selection = typeLevelSelection(type);

  if (selection) {
    mergeSelection(state, compatibleOnly ? withoutConflicts(state, selection) : selection);
  }
}

function typeLevelSelection(type: GraphQLNamedType): SelectionMap | undefined {
  const { pothosPrismaInclude, pothosPrismaSelect } = (type.extensions ?? {}) as {
    pothosPrismaInclude?: IncludeMap;
    pothosPrismaSelect?: IncludeMap;
  };

  if (!(pothosPrismaInclude ?? pothosPrismaSelect)) {
    return undefined;
  }

  return {
    select: pothosPrismaSelect ? { ...pothosPrismaSelect } : undefined,
    include: pothosPrismaInclude ? { ...pothosPrismaInclude } : undefined,
  };
}

/** The first relation (or count) of `selection` whose arguments conflict with `state`. */
function conflictingRelation(state: SelectionState, { select, include }: SelectionMap) {
  const conflict =
    Object.entries(select ?? {}).find(
      ([key, value]) => !selectionCompatible(state, { select: { [key]: value } }, true),
    ) ??
    Object.entries(include ?? {}).find(
      ([key, value]) => !selectionCompatible(state, { include: { [key]: value } }, true),
    );

  return conflict?.[0];
}

function withoutConflicts(state: SelectionState, { select, include }: SelectionMap): SelectionMap {
  return {
    select:
      select &&
      compatibleEntries(select, (entry) => selectionCompatible(state, { select: entry }, true)),
    include:
      include &&
      compatibleEntries(include, (entry) => selectionCompatible(state, { include: entry }, true)),
  };
}

function compatibleEntries(map: IncludeMap, compatible: (entry: IncludeMap) => boolean) {
  const entries: IncludeMap = {};

  for (const [key, value] of Object.entries(map)) {
    if (key === '_count' && typeof value === 'object' && value.select) {
      // Counts are checked one at a time, so one conflicting count leaves the others in.
      const counts = compatibleEntries(value.select, (count) =>
        compatible({ _count: { select: count } }),
      );

      if (Object.keys(counts).length > 0) {
        entries._count = { select: counts };
      }
    } else if (compatible({ [key]: value })) {
      entries[key] = value;
    }
  }

  return entries;
}

export interface IndirectPathSegment {
  type?: string;
  name: string;
}

export interface IndirectSelection {
  /** The GraphQL type of the matched field's return type */
  type: GraphQLNamedType;
  field: FieldNode;
  /** Aliased field names from the starting selection to the matched field */
  path: string[];
  deferred: boolean;
}

/**
 * Finds every field selected at the end of one of `paths`, starting from `selection` (which is
 * expected to be a selection on `type`). Paths are followed through fragments; see
 * `resolveFragmentTypes` for the rules. Matches are returned in document order.
 *
 * When `targetType` is given, matches whose field returns a different prisma model are dropped:
 * several implementations of an interface may share a field name while returning different models,
 * and their selections must never be merged into the same query. Types without a model always
 * match.
 */
function findIndirectSelections(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  paths: IndirectPathSegment[][],
  {
    prefix,
    path = [],
    deferred = false,
    targetType,
  }: {
    prefix?: IndirectPathSegment[];
    path?: string[];
    deferred?: boolean;
    targetType?: GraphQLNamedType;
  } = {},
): IndirectSelection[] {
  const matches: IndirectSelection[] = [];

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

  const targetModel = targetType && getPrismaModel(targetType, info);

  if (!targetModel) {
    return matches;
  }

  return matches.filter((match) => {
    const model = getPrismaModel(match.type, info);

    return !model || model === targetModel;
  });
}

/**
 * Recursive step of `findIndirectSelections`.
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
  matches: IndirectSelection[],
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
          !selectionSkipped(info, sel)
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
        if (selectionSkipped(info, sel)) {
          continue;
        }

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
          deferred || isDeferredFragment(sel, info),
          matches,
        );
        continue;
      }
      case Kind.INLINE_FRAGMENT: {
        if (selectionSkipped(info, sel)) {
          continue;
        }

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
          deferred || isDeferredFragment(sel, info),
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
 * The type to plan a fragment's selections against, or null when the fragment cannot apply to
 * `type`. A fragment on an interface `type` implements is planned against `type`, whose field map
 * already carries the interface fields and their `select` extensions. A fragment on another type
 * of the same model (a variant, or an interface of the model) is planned against that type.
 *
 * A different object type of the same model is entered only under an abstract declared type
 * (`underAbstractType`): under a concrete one the fragment can never execute as that object, so
 * its type-level selection has nothing to contribute and must not conflict.
 */
function typeForFragment(
  type: GraphQLInterfaceType | GraphQLObjectType,
  condition: GraphQLNamedType,
  underAbstractType: boolean,
): GraphQLInterfaceType | GraphQLObjectType | null {
  if (condition.name === type.name) {
    return type;
  }

  if (
    isInterfaceType(condition) &&
    type.getInterfaces().some((iface) => iface.name === condition.name)
  ) {
    return type;
  }

  if (
    (isObjectType(condition) || isInterfaceType(condition)) &&
    condition.extensions?.pothosPrismaModel === type.extensions.pothosPrismaModel
  ) {
    return isObjectType(condition) && !underAbstractType ? null : condition;
  }

  return null;
}

/**
 * Plans the selection set of a field whose declared return type is `type`; `underAbstractType`
 * says whether that declared type is abstract, which decides which same-model fragments enter.
 */
function addNestedSelections(
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selections: SelectionSetNode,
  indirectPath: string[],
  underAbstractType: boolean,
) {
  // Every variant a fragment at this node enters is merged before any field here is planned, so
  // conflicts are only ever found between type-level selections, whatever order the document
  // lists fields and fragments in. A field-level select that conflicts with a variant's
  // type-level selection then falls back to its own query, as it would against the node's own
  // type-level selection.
  enterVariants(type, info, state, selections, underAbstractType);
  addSelections(type, context, info, state, selections, indirectPath, underAbstractType);
}

/**
 * Merges the type-level selection of every variant that fragments under `type` enter, following
 * nested fragments the way `addFragmentSelections` does: a fragment that does not apply to `type`
 * contributes no variant of its own, but a fragment nested inside it may.
 */
function enterVariants(
  type: GraphQLInterfaceType | GraphQLObjectType,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selections: SelectionSetNode,
  underAbstractType: boolean,
) {
  for (const selection of selections.selections) {
    if (selection.kind === Kind.FIELD || fragmentSkipped(info, state, selection)) {
      continue;
    }

    const fragment =
      selection.kind === Kind.FRAGMENT_SPREAD ? info.fragments[selection.name.value] : selection;
    const condition = fragment.typeCondition
      ? info.schema.getType(fragment.typeCondition.name.value)!
      : type;
    const fragmentType = typeForFragment(type, condition, underAbstractType);

    if (fragmentType && fragmentType !== type) {
      enterVariant(type, fragmentType, state);
    }

    enterVariants(fragmentType ?? type, info, state, fragment.selectionSet, underAbstractType);
  }
}

function addSelections(
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selections: SelectionSetNode,
  indirectPath: string[],
  underAbstractType: boolean,
  skipFields = false,
) {
  for (const selection of selections.selections) {
    switch (selection.kind) {
      case Kind.FIELD:
        if (!skipFields) {
          addFieldSelection(type, context, info, state, selection, indirectPath);
        }

        continue;
      case Kind.FRAGMENT_SPREAD: {
        if (fragmentSkipped(info, state, selection)) {
          continue;
        }

        const fragment = info.fragments[selection.name.value];

        addFragmentSelections(
          type,
          context,
          info,
          state,
          info.schema.getType(fragment.typeCondition.name.value)!,
          fragment.selectionSet,
          indirectPath,
          underAbstractType,
        );

        continue;
      }
      case Kind.INLINE_FRAGMENT:
        if (fragmentSkipped(info, state, selection)) {
          continue;
        }

        addFragmentSelections(
          type,
          context,
          info,
          state,
          selection.typeCondition ? info.schema.getType(selection.typeCondition.name.value)! : type,
          selection.selectionSet,
          indirectPath,
          underAbstractType,
        );

        continue;

      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(selection as { kind: string }).kind}`,
        );
    }
  }
}

/**
 * Walks the selections of a fragment on `condition` found under `type`. A fragment that cannot
 * apply to `type` contributes no fields, but a fragment nested inside it may still narrow back to
 * `type`, so nested fragments are classified against `type` as usual. A fragment that enters a
 * variant walks as the variant; its type-level selection was merged by `enterVariants` already.
 */
function addFragmentSelections(
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  condition: GraphQLNamedType,
  selections: SelectionSetNode,
  indirectPath: string[],
  underAbstractType: boolean,
) {
  const fragmentType = typeForFragment(type, condition, underAbstractType);

  addSelections(
    fragmentType ?? type,
    context,
    info,
    state,
    selections,
    indirectPath,
    underAbstractType,
    !fragmentType,
  );
}

/**
 * Merges the type-level selection of `variant` when a fragment moves the walk from `type` to
 * another type of the same model, so the variant's resolvers find what its `select` promises. A
 * variant without a `select` is an include-mode type and flips the state to include mode. Unlike
 * a field-level select, a type-level selection has no per-field fallback, so relation arguments
 * that conflict with what is already selected are an error.
 */
function enterVariant(
  type: GraphQLInterfaceType | GraphQLObjectType,
  variant: GraphQLInterfaceType | GraphQLObjectType,
  state: SelectionState,
) {
  const relation = conflictingRelation(state, typeLevelSelection(variant) ?? {});

  if (relation) {
    throw new PothosValidationError(
      `Type-level selections of ${type.name} and ${variant.name} conflict on relation "${relation}". Move the relation arguments to a field-level select on one of the types.`,
    );
  }

  applyTypeSelection(variant, state);
}

function addFieldSelection(
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
) {
  if (selection.name.value.startsWith('__') || selectionSkipped(info, selection)) {
    return;
  }

  const field = type.getFields()[selection.name.value];

  if (!field) {
    throw new PothosValidationError(`Unknown field ${selection.name.value} on ${type.name}`);
  }

  const fieldSelect = field.extensions?.pothosPrismaSelect as FieldSelection | undefined;

  let fieldSelectionMap: SelectionMap | false | null | undefined;

  let mappings: LoaderMappings = {};

  if (typeof fieldSelect === 'function') {
    const args = getMappedArgumentValues(field, selection, context, info) as Record<
      string,
      unknown
    >;

    fieldSelectionMap = fieldSelect(
      args,
      context,
      (rawQuery, indirectInclude, expectedType) => {
        const returnType = getNamedType(field.type);
        const query = typeof rawQuery === 'function' ? rawQuery(args, context) : rawQuery;

        const normalizedIndirectInclude = Array.isArray(indirectInclude)
          ? normalizeInclude(
              indirectInclude,
              getIndirectType(returnType, info),
              expectedType ? getNamedType(info.schema.getType(expectedType)) : undefined,
            )
          : indirectInclude;

        const fieldTargetType = getIndirectType(
          normalizedIndirectInclude
            ? info.schema.getType(normalizedIndirectInclude.getType())!
            : returnType,
          info,
        );
        const fieldState = createStateForType(
          fieldTargetType,
          info,
          state.skipDeferredFragments,
          state,
        );

        if (typeof query === 'object' && Object.keys(query).length > 0) {
          mergeSelection(fieldState, { select: {}, ...query });
        }

        if (
          (!!normalizedIndirectInclude?.path && normalizedIndirectInclude.path.length > 0) ||
          (!!normalizedIndirectInclude?.paths && normalizedIndirectInclude.paths.length > 0)
        ) {
          const matches = findIndirectSelections(
            returnType,
            info,
            selection,
            normalizedIndirectInclude.paths ?? [normalizedIndirectInclude.path!],
            { prefix: indirectIncludePath(returnType), targetType: fieldTargetType },
          );

          for (const match of matches) {
            addTypeSelectionsForField(
              match.type,
              context,
              info,
              fieldState,
              match.field,
              match.path,
              match.deferred,
            );
          }
        } else if (normalizedIndirectInclude) {
          const targetType = info.schema.getType(normalizedIndirectInclude.getType())!;
          if (targetType !== returnType) {
            addTypeSelectionsForField(
              targetType,
              context,
              info,
              fieldState,
              selection,
              [],
              undefined,
              returnType,
            );
          }
        }

        addTypeSelectionsForField(returnType, context, info, fieldState, selection, []);

        mappings = fieldState.mappings;

        return selectionToQuery(fieldState);
      },
      (path) => {
        // The return type may be a wrapper (an errors plugin result, for instance) whose own
        // path leads to the type the caller's path starts from.
        const returnType = getNamedType(field.type);
        const matches = findIndirectSelections(
          returnType,
          info,
          selection,
          [path.map((name) => ({ name }))],
          { prefix: indirectIncludePath(returnType) },
        );

        return matches[0]?.field ?? null;
      },
    );
  } else {
    fieldSelectionMap = { select: fieldSelect };
  }

  // A falsy map means the field selects nothing here: it is neither merged nor mapped, so it
  // loads its own data when resolved.
  if (fieldSelect && fieldSelectionMap && selectionCompatible(state, fieldSelectionMap, true)) {
    mergeSelection(state, fieldSelectionMap);

    state.mappings = mergeMappings(state.mappings, {
      [selection.alias?.value ?? selection.name.value]: {
        field: selection.name.value,
        type: type.name,
        mappings,
        indirectPath,
      },
    });
  }
}

function mergeMappings(existing: LoaderMappings, incoming: LoaderMappings): LoaderMappings {
  const result: LoaderMappings = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (result[key]) {
      result[key] = {
        ...result[key],
        mappings: mergeMappings(result[key].mappings, value.mappings),
      };
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function queryFromInfo<
  Select extends SelectionMap['select'] | undefined = undefined,
  Include extends SelectionMap['select'] | undefined = undefined,
>({
  context,
  info,
  typeName,
  select,
  include,
  path = [],
  paths = [],
  withUsageCheck = false,
  skipDeferredFragments = true,
}: {
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  path?: (string | { name: string; type?: string })[];
  paths?: (string | { name: string; type?: string })[][];
  withUsageCheck?: boolean;
  skipDeferredFragments?: boolean;
} & (
  | { include?: Include; select?: never }
  | { select?: Select; include?: never }
)): undefined extends Include
  ? {
      select: Select;
    }
  : { include: Include } {
  const returnType = getNamedType(info.returnType);
  const type = typeName ? info.schema.getTypeMap()[typeName] : returnType;

  let state: SelectionState | undefined;
  const initialSelection = select ? { select } : include ? { include } : undefined;

  if (path.length > 0 || paths.length > 0) {
    const matches = findIndirectSelections(
      returnType,
      info,
      info.fieldNodes[0],
      paths.length > 0
        ? paths.map((p) => p.map((n) => (typeof n === 'string' ? { name: n } : n)))
        : [path.map((n) => (typeof n === 'string' ? { name: n } : n))],
      { prefix: indirectIncludePath(returnType), targetType: type },
    );

    if (matches.length > 0) {
      state = createStateForType(
        typeName ? type : matches[0].type,
        info,
        skipDeferredFragments,
        undefined,
        initialSelection,
      );

      for (const match of matches) {
        // A matched type with its own model (including variants of the target model) is walked
        // with its own field map. Types without a model (interfaces, wrappers) are walked as the
        // requested type so its fields can be found.
        const walkType = typeName && !getPrismaModel(match.type, info) ? type : match.type;

        addTypeSelectionsForField(
          walkType,
          context,
          info,
          state,
          match.field,
          match.path,
          match.deferred,
          match.type,
        );
      }
    }
  } else {
    state = createStateForType(type, info, skipDeferredFragments, undefined, initialSelection);

    addTypeSelectionsForField(
      type,
      context,
      info,
      state,
      info.fieldNodes[0],
      [],
      undefined,
      returnType,
    );
  }

  if (!state) {
    // Nothing is selected under the paths: there is nothing to plan and nothing to map, so the
    // caller gets back its own selection (never an empty `select`, which prisma rejects).
    const query = (initialSelection ?? {}) as { select: Select; include: Include };

    return withUsageCheck ? wrapWithUsageCheck(query) : query;
  }

  setLoaderMappings(context, info, state.mappings);

  const query = selectionToQuery(state) as { select: Select; include: Include };

  return withUsageCheck ? wrapWithUsageCheck(query) : query;
}

export function selectionStateFromInfo(
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments: boolean,
  typeName?: string,
) {
  const type = typeName ? info.schema.getTypeMap()[typeName] : info.parentType;

  const state = createStateForType(type, info, skipDeferredFragments);

  if (!(isObjectType(type) || isInterfaceType(type))) {
    throw new PothosValidationError(
      'Prisma plugin can only resolve includes for object and interface types',
    );
  }

  // The same response key can be selected more than once (through fragments); every occurrence
  // contributes to what the resolver will read.
  for (const fieldNode of info.fieldNodes) {
    addFieldSelection(type, context, info, state, fieldNode, []);
  }

  // The loaded row replaces the parent the field resolver sees, so besides the field's own
  // selection it carries the parent type's type-level selection. The field is what the row is
  // loaded for, so it is merged first and a type-level relation whose arguments conflict with
  // it is left out.
  applyTypeSelection(type, state, { compatibleOnly: true });

  return state;
}

function createStateForType(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  skipDeferredFragments: boolean,
  parent?: SelectionState,
  initialSelections?: SelectionMap,
) {
  const targetType = getIndirectType(type, info);

  const fieldMap = targetType.extensions?.pothosPrismaFieldMap as FieldMap;

  const state = createState(
    fieldMap,
    targetType.extensions?.pothosPrismaSelect ? 'select' : 'include',
    skipDeferredFragments,
    parent,
  );

  if (initialSelections) {
    mergeSelection(state, initialSelections);
  }

  return state;
}

function getPrismaModel(type: GraphQLNamedType, info: GraphQLResolveInfo) {
  return getIndirectType(type, info).extensions?.pothosPrismaModel as string | undefined;
}

/** The path a wrapper type's own `pothosIndirectInclude` takes to reach the wrapped type. */
function indirectIncludePath(type: GraphQLNamedType) {
  return (type.extensions?.pothosIndirectInclude as IndirectInclude | undefined)?.path;
}

/**
 * Whether the field being resolved selects `path` (`['totalCount']`, say) in any of its nodes,
 * seen through fragments, directives, and any wrapper on the return type (an errors plugin
 * result, for instance) so the resolve side reads the document the way the planner does.
 */
export function selectsPath(info: GraphQLResolveInfo, path: string[]): boolean {
  const returnType = getNamedType(info.returnType);
  const prefix = indirectIncludePath(returnType);
  const segments = path.map((name) => ({ name }));

  return info.fieldNodes.some(
    (node) => findIndirectSelections(returnType, info, node, [segments], { prefix }).length > 0,
  );
}

export function getIndirectType(type: GraphQLNamedType, info: GraphQLResolveInfo) {
  let targetType = type;

  while (targetType.extensions?.pothosIndirectInclude) {
    targetType = info.schema.getType(
      (targetType.extensions.pothosIndirectInclude as IndirectInclude).getType(),
    )!;
  }

  return targetType;
}

function normalizeInclude(
  path: string[],
  type: GraphQLNamedType,
  expectedType?: GraphQLNamedType,
): IndirectInclude {
  let currentType = path.length > 0 ? type : (expectedType ?? type);

  // Segments intentionally omit `type`: a segment `type` pins the fragment type condition the
  // field must be found under, which is not known for a plain string path. The walker narrows
  // through fragments on its own.
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

/** Whether `@skip` / `@include` leave a field or fragment out of the response. */
function selectionSkipped(
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentSpreadNode | InlineFragmentNode,
) {
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

/**
 * Whether a fragment contributes nothing to this plan: it is left out by `@skip` / `@include`, or
 * it is deferred and deferred fragments are planned on their own.
 */
function fragmentSkipped(
  info: GraphQLResolveInfo,
  state: SelectionState,
  fragment: FragmentSpreadNode | InlineFragmentNode,
) {
  return (
    selectionSkipped(info, fragment) ||
    (state.skipDeferredFragments && isDeferredFragment(fragment, info))
  );
}

function isDeferredFragment(
  node: FragmentSpreadNode | InlineFragmentNode,
  info: GraphQLResolveInfo,
) {
  const deferDirective = info.schema.getDirective('defer');
  if (!deferDirective) {
    return false;
  }

  const defer = getDirectiveValues(deferDirective, node, info.variableValues);
  return !!defer && defer.if !== false;
}
