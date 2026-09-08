import { getMappedArgumentValues, PothosValidationError } from '@pothos/core';
import {
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

function addTypeSelectionsForField(
  type: GraphQLNamedType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
  deferred?: boolean,
) {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const { pothosPrismaInclude, pothosPrismaSelect, pothosIndirectInclude, pothosPrismaModel } =
    (type.extensions ?? {}) as {
      pothosPrismaModel?: string;
      pothosPrismaInclude?: IncludeMap;
      pothosPrismaSelect?: IncludeMap;
      pothosIndirectInclude?: IndirectInclude;
    };

  if (
    (!!pothosIndirectInclude?.path && pothosIndirectInclude.path.length > 0) ||
    (!!pothosIndirectInclude?.paths && pothosIndirectInclude.paths.length === 0)
  ) {
    resolveIndirectIncludePaths(
      type,
      info,
      selection,
      [],
      pothosIndirectInclude.paths ?? [pothosIndirectInclude.path!],
      indirectPath,
      (resolvedType, field, path, deferred) => {
        addTypeSelectionsForField(resolvedType, context, info, state, field, path, deferred);
      },
    );
  } else if (pothosIndirectInclude) {
    addTypeSelectionsForField(
      info.schema.getType(pothosIndirectInclude.getType())!,
      context,
      info,
      state,
      selection,
      indirectPath,
      deferred,
    );
    return;
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return;
  }

  if (pothosPrismaModel && !pothosPrismaSelect) {
    state.mode = 'include';
  }

  if (pothosPrismaInclude ?? pothosPrismaSelect) {
    mergeSelection(state, {
      select: pothosPrismaSelect ? { ...pothosPrismaSelect } : undefined,
      include: pothosPrismaInclude ? { ...pothosPrismaInclude } : undefined,
    });
  }

  if (selection.selectionSet && (!deferred || !state.skipDeferredFragments)) {
    addNestedSelections(type, context, info, state, selection.selectionSet, indirectPath);
  }
}

function resolveIndirectIncludePaths(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  pathPrefix: { type?: string; name: string }[],
  includePaths: { type?: string; name: string }[][],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[], deferred: boolean) => void,
  deferred = false,
) {
  for (const includePath of includePaths) {
    if (pathPrefix.length > 0) {
      resolveIndirectInclude(
        type,
        info,
        selection,
        [...pathPrefix, ...includePath],
        path,
        resolve,
        deferred,
      );
    } else {
      resolveIndirectInclude(type, info, selection, includePath, path, resolve, deferred);
    }
  }
}

function resolveIndirectInclude(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  includePath: { type?: string; name: string }[],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[], deferred: boolean) => void,
  deferred = false,
  expectedType = type,
) {
  if (includePath.length === 0) {
    resolve(type, selection as FieldNode, path, deferred);
    return;
  }

  const [include, ...rest] = includePath;
  if (!selection.selectionSet || !include) {
    return;
  }

  for (const sel of selection.selectionSet.selections) {
    switch (sel.kind) {
      case Kind.FIELD:
        if (
          expectedType.name === type.name &&
          !fieldSkipped(info, sel) &&
          sel.name.value === include.name &&
          (isObjectType(type) || isInterfaceType(type))
        ) {
          const returnType = getNamedType(type.getFields()[sel.name.value].type);

          resolveIndirectInclude(
            returnType,
            info,
            sel,
            rest,
            [...path, sel.alias?.value ?? sel.name.value],
            resolve,
            deferred,
          );
        }
        continue;
      case Kind.FRAGMENT_SPREAD: {
        const fragment = info.fragments[sel.name.value];
        const next = resolveFragmentTypes(
          info,
          info.schema.getType(fragment.typeCondition.name.value)!,
          type,
          expectedType,
          include,
        );

        resolveIndirectInclude(
          next.type,
          info,
          fragment,
          includePath,
          path,
          resolve,
          deferred || isDeferredFragment(sel, info),
          next.expectedType,
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

        resolveIndirectInclude(
          next.type,
          info,
          sel,
          includePath,
          path,
          resolve,
          deferred || isDeferredFragment(sel, info),
          next.expectedType,
        );

        continue;
      }

      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(selection as { kind: string }).kind}`,
        );
    }
  }
}

/**
 * Determines the type to walk and the type fields are expected on when descending into a fragment
 * while resolving an indirect include path.
 *
 * - A segment with an explicit `type` pins the expected type.
 * - A fragment that narrows the expected type (`... on Impl` under an interface or union) advances
 *   the expected type so the segment's field can be found on the concrete type.
 * - A fragment that widens the expected type (`... on Node` under `User`) keeps walking as the
 *   expected type, since every field of the wider type also exists on it.
 * - Fragments on unrelated types keep the expected type and their fields are skipped until a nested
 *   fragment narrows back to it.
 */
function resolveFragmentTypes(
  info: GraphQLResolveInfo,
  fragmentType: GraphQLNamedType | undefined,
  type: GraphQLNamedType,
  expectedType: GraphQLNamedType,
  include: { type?: string; name: string },
) {
  const expected = include.type ? info.schema.getType(include.type)! : expectedType;

  if (!fragmentType) {
    return { type, expectedType: expected };
  }

  if (fragmentType.name === expected.name) {
    return { type: fragmentType, expectedType: expected };
  }

  if (
    isAbstractType(expected) &&
    (isObjectType(fragmentType) || isInterfaceType(fragmentType)) &&
    info.schema.isSubType(expected, fragmentType)
  ) {
    return { type: fragmentType, expectedType: fragmentType };
  }

  if (
    isAbstractType(fragmentType) &&
    (isObjectType(expected) || isInterfaceType(expected)) &&
    info.schema.isSubType(fragmentType, expected)
  ) {
    return { type: expected, expectedType: expected };
  }

  return { type: fragmentType, expectedType: expected };
}

function addNestedSelections(
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selections: SelectionSetNode,
  indirectPath: string[],
  expectedType = type,
) {
  let parentType = type;
  for (const selection of selections.selections) {
    switch (selection.kind) {
      case Kind.FIELD:
        if (expectedType.name !== type.name) {
          continue;
        }
        addFieldSelection(type, context, info, state, selection, indirectPath);

        continue;
      case Kind.FRAGMENT_SPREAD:
        if (state.skipDeferredFragments && isDeferredFragment(selection, info)) {
          continue;
        }

        parentType = info.schema.getType(
          info.fragments[selection.name.value].typeCondition.name.value,
        )! as GraphQLObjectType;

        addNestedSelections(
          parentType,
          context,
          info,
          state,
          info.fragments[selection.name.value].selectionSet,
          indirectPath,
          parentType.extensions?.pothosPrismaModel === type.extensions.pothosPrismaModel
            ? parentType
            : expectedType,
        );

        continue;

      case Kind.INLINE_FRAGMENT:
        if (state.skipDeferredFragments && isDeferredFragment(selection, info)) {
          continue;
        }

        parentType = selection.typeCondition
          ? (info.schema.getType(selection.typeCondition.name.value) as GraphQLObjectType)
          : type;

        addNestedSelections(
          parentType,
          context,
          info,
          state,
          selection.selectionSet,
          indirectPath,
          parentType.extensions?.pothosPrismaModel === type.extensions.pothosPrismaModel
            ? parentType
            : expectedType,
        );

        continue;

      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(selection as { kind: string }).kind}`,
        );
    }
  }
}

function addFieldSelection(
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
) {
  if (selection.name.value.startsWith('__') || fieldSkipped(info, selection)) {
    return;
  }

  const field = type.getFields()[selection.name.value];

  if (!field) {
    throw new PothosValidationError(`Unknown field ${selection.name.value} on ${type.name}`);
  }

  const fieldSelect = field.extensions?.pothosPrismaSelect as FieldSelection | undefined;

  let fieldSelectionMap: SelectionMap;

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
          resolveIndirectIncludePaths(
            returnType,
            info,
            selection,
            (returnType.extensions?.pothosIndirectInclude as { path: [] })?.path ?? [],
            normalizedIndirectInclude?.paths ??
              (normalizedIndirectInclude?.path ? [normalizedIndirectInclude.path] : []),
            [],
            (resolvedType, resolvedField, path, deferred) => {
              if (!matchesTargetModel(resolvedType, fieldTargetType, info)) {
                return;
              }

              addTypeSelectionsForField(
                resolvedType,
                context,
                info,
                fieldState,
                resolvedField,
                path,
                deferred,
              );
            },
          );
        } else if (normalizedIndirectInclude) {
          const targetType = info.schema.getType(normalizedIndirectInclude.getType())!;
          if (targetType !== returnType) {
            addTypeSelectionsForField(targetType, context, info, fieldState, selection, []);
          }
        }

        addTypeSelectionsForField(returnType, context, info, fieldState, selection, []);

        mappings = fieldState.mappings;

        return selectionToQuery(fieldState);
      },
      (path) => {
        if (path.length === 0) {
          return selection;
        }

        const returnType = getNamedType(field.type);
        let node: FieldNode | null = null;

        resolveIndirectInclude(
          returnType,
          info,
          selection,
          path.map((name) => ({
            name,
          })),
          [],
          (_, resolvedField) => {
            node = resolvedField;
          },
        );

        return node;
      },
    );
  } else {
    fieldSelectionMap = { select: fieldSelect };
  }

  if (fieldSelect && selectionCompatible(state, fieldSelectionMap, true)) {
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
    const { pothosIndirectInclude } = (returnType.extensions ?? {}) as {
      pothosIndirectInclude?: IndirectInclude;
    };

    resolveIndirectInclude(
      returnType,
      info,
      info.fieldNodes[0],
      pothosIndirectInclude?.path ?? [],
      [],
      (indirectType, indirectField, subPath, deferred) => {
        resolveIndirectIncludePaths(
          indirectType,
          info,
          indirectField,
          [],
          paths.length > 0
            ? paths.map((p) => p.map((n) => (typeof n === 'string' ? { name: n } : n)))
            : [path.map((n) => (typeof n === 'string' ? { name: n } : n))],
          subPath,
          (resolvedType, resolvedField, nested, deferred) => {
            if (!matchesTargetModel(resolvedType, type, info)) {
              return;
            }

            state = createStateForType(
              typeName ? type : resolvedType,
              info,
              skipDeferredFragments,
              undefined,
              initialSelection,
            );

            addTypeSelectionsForField(
              typeName ? type : resolvedType,
              context,
              info,
              state,
              resolvedField,
              nested,
              deferred,
            );
          },
          deferred,
        );
      },
    );
  } else {
    state = createStateForType(type, info, skipDeferredFragments, undefined, initialSelection);

    addTypeSelectionsForField(type, context, info, state, info.fieldNodes[0], []);
  }

  if (!state) {
    state = createStateForType(type, info, skipDeferredFragments, undefined, initialSelection);
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

  addFieldSelection(type, context, info, state, info.fieldNodes[0], []);

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

/**
 * Checks whether a field matched by an indirect include path returns the same prisma model as the
 * type the selection is being built for. Multiple implementations of an interface may share a field
 * name while returning different models; selections for a different model are skipped rather than
 * merged into the wrong query. Types without a prisma model (interfaces, wrappers) always match.
 */
function matchesTargetModel(
  resolvedType: GraphQLNamedType,
  targetType: GraphQLNamedType,
  info: GraphQLResolveInfo,
) {
  const resolvedModel = getIndirectType(resolvedType, info).extensions?.pothosPrismaModel;
  const targetModel = getIndirectType(targetType, info).extensions?.pothosPrismaModel;

  return !resolvedModel || !targetModel || resolvedModel === targetModel;
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

function fieldSkipped(info: GraphQLResolveInfo, selection: FieldNode) {
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
