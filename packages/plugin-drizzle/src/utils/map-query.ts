import { getMappedArgumentValues, PothosValidationError } from '@pothos/core';
import type { DBQueryConfig, TableRelationalConfig } from 'drizzle-orm';
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
  type GraphQLOutputType,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  getDirectiveValues,
  getNamedType,
  type InlineFragmentNode,
  isAbstractType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  Kind,
  type SelectionSetNode,
} from 'graphql';
import type { DrizzleFieldSelection, FieldPathInfo, PathInfo } from '../types.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import { type LoaderMappings, setLoaderMappings } from './loader-map.js';
import {
  createState,
  mergeSelection,
  type SelectionMap,
  type SelectionState,
  selectionCompatible,
  selectionToQuery,
} from './selections.js';
import { wrapWithUsageCheck } from './usage.js';

export interface IndirectInclude {
  getType: () => string;
  path?: { type?: string; name: string }[];
  paths?: { type?: string; name: string }[][];
}

function addTypeSelectionsForField(
  config: PothosDrizzleSchemaConfig,
  type: GraphQLNamedType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
  deferred?: boolean,
  segments: FieldPathInfo[] = [],
) {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const { pothosDrizzleSelect, pothosIndirectInclude } = (type.extensions ?? {}) as {
    pothosIndirectInclude?: IndirectInclude;
    pothosDrizzleSelect?: boolean | DBQueryConfig<'one'>;
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
      { path: indirectPath, deferred },
    );

    for (const match of matches) {
      addTypeSelectionsForField(
        config,
        match.type,
        context,
        info,
        state,
        match.field,
        match.path,
        match.deferred,
        segments,
      );
    }
  } else if (pothosIndirectInclude) {
    addTypeSelectionsForField(
      config,
      info.schema.getType(pothosIndirectInclude.getType())!,
      context,
      info,
      state,
      selection,
      indirectPath,
      deferred,
      segments,
    );
    return;
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return;
  }

  if (pothosDrizzleSelect) {
    mergeSelection(config, state, pothosDrizzleSelect === true ? true : { ...pothosDrizzleSelect });
  }

  if (selection.selectionSet && (!deferred || !state.skipDeferredFragments)) {
    addNestedSelections(
      config,
      type,
      context,
      info,
      state,
      selection.selectionSet,
      indirectPath,
      segments,
    );
  }
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
 * When `targetType` is given, matches whose field returns a different drizzle table are dropped:
 * several implementations of an interface may share a field name while returning different tables,
 * and their selections must never be merged into the same query. Types without a table always
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

  const targetModel = targetType && getDrizzleModel(targetType, info);

  if (!targetModel) {
    return matches;
  }

  return matches.filter((match) => {
    const model = getDrizzleModel(match.type, info);

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
          !fieldSkipped(info, sel)
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
          deferred || isDeferredFragment(sel, info),
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

function typeForFragment(
  type: GraphQLInterfaceType | GraphQLObjectType,
  condition: GraphQLNamedType,
): GraphQLInterfaceType | GraphQLObjectType | null {
  if (isObjectType(type)) {
    if (condition.name === type.name) {
      return type;
    }

    if (
      isInterfaceType(condition) &&
      type.getInterfaces().some((iface) => iface.name === condition.name)
    ) {
      return type;
    }

    return null;
  }

  if (
    (isObjectType(condition) || isInterfaceType(condition)) &&
    condition.extensions?.pothosDrizzleModel === type.extensions.pothosDrizzleModel
  ) {
    return condition;
  }

  return null;
}

function addNestedSelections(
  config: PothosDrizzleSchemaConfig,
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selections: SelectionSetNode,
  indirectPath: string[],
  segments: FieldPathInfo[] = [],
) {
  let parentType: GraphQLInterfaceType | GraphQLObjectType | null = type;
  for (const selection of selections.selections) {
    switch (selection.kind) {
      case Kind.FIELD:
        addFieldSelection(config, type, context, info, state, selection, indirectPath, segments);

        continue;
      case Kind.FRAGMENT_SPREAD:
        if (state.skipDeferredFragments && isDeferredFragment(selection, info)) {
          continue;
        }

        parentType = typeForFragment(
          type,
          info.schema.getType(info.fragments[selection.name.value].typeCondition.name.value)!,
        );
        if (!parentType) {
          continue;
        }

        addNestedSelections(
          config,
          parentType,
          context,
          info,
          state,
          info.fragments[selection.name.value].selectionSet,
          indirectPath,
          segments,
        );

        continue;

      case Kind.INLINE_FRAGMENT:
        if (state.skipDeferredFragments && isDeferredFragment(selection, info)) {
          continue;
        }

        parentType = selection.typeCondition
          ? typeForFragment(type, info.schema.getType(selection.typeCondition.name.value)!)
          : type;
        if (!parentType) {
          continue;
        }

        addNestedSelections(
          config,
          parentType,
          context,
          info,
          state,
          selection.selectionSet,
          indirectPath,
          segments,
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
  config: PothosDrizzleSchemaConfig,
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
  segments: FieldPathInfo[] = [],
) {
  if (selection.name.value.startsWith('__') || fieldSkipped(info, selection)) {
    return;
  }
  const field = type.getFields()[selection.name.value];
  if (!field) {
    throw new PothosValidationError(`Unknown field ${selection.name.value} on ${type.name}`);
  }

  const allSegments = [
    ...segments,
    {
      field: selection.name.value,
      alias: selection.alias?.value ?? selection.name.value,
      parentType: type.name,
      isList: isListField(field.type),
    },
  ];

  const fieldSelect = field.extensions?.pothosDrizzleSelect as DrizzleFieldSelection | undefined;

  let fieldSelectionMap: DBQueryConfig<'one'> | undefined;
  let mappings: LoaderMappings = {};
  if (typeof fieldSelect === 'function') {
    const pathInfo: PathInfo = {
      path: allSegments.map((s) => `${s.parentType}.${s.field}`),
      segments: allSegments,
    };

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
        const fieldTargetType = normalizedIndirectInclude
          ? info.schema.getType(normalizedIndirectInclude.getType())!
          : returnType;
        const fieldState = createStateForSelection(config, info, fieldTargetType, state);

        if (typeof query === 'object' && Object.keys(query).length > 0) {
          mergeSelection(config, fieldState, { columns: {}, ...query });
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
            {
              prefix: (returnType.extensions?.pothosIndirectInclude as IndirectInclude | undefined)
                ?.path,
              targetType: fieldTargetType,
            },
          );

          for (const match of matches) {
            addTypeSelectionsForField(
              config,
              match.type,
              context,
              info,
              fieldState,
              match.field,
              match.path,
              match.deferred,
              allSegments,
            );
          }
        }
        addTypeSelectionsForField(
          config,
          returnType,
          context,
          info,
          fieldState,
          selection,
          [],
          undefined,
          allSegments,
        );
        mappings = fieldState.mappings;
        return selectionToQuery(config, fieldState);
      },
      (path) => {
        const returnType = getNamedType(field.type);
        const matches = findIndirectSelections(returnType, info, selection, [
          path.map((name) => ({ name })),
        ]);

        return matches.length > 0 ? matches[matches.length - 1].field : null;
      },
      pathInfo,
    );
  } else {
    fieldSelectionMap = fieldSelect!;
  }

  if (fieldSelect && selectionCompatible(state, fieldSelectionMap, true)) {
    mergeSelection(config, state, fieldSelectionMap);

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

export interface QueryFromInfoOptions<T extends SelectionMap> {
  config: PothosDrizzleSchemaConfig;
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  select?: T;
  path?: (string | { name: string; type?: string })[];
  paths?: (string | { name: string; type?: string })[][];
  withUsageCheck?: boolean;
}

export function queryFromInfo<T extends SelectionMap>({
  withUsageCheck,
  ...options
}: QueryFromInfoOptions<T>): T {
  const state = stateFromInfo(options);

  setLoaderMappings(options.context, options.info, state.mappings);

  const query = selectionToQuery(options.config, state) as T;

  return withUsageCheck ? wrapWithUsageCheck(query) : query;
}

export function stateFromInfo<T extends SelectionMap>({
  config,
  context,
  info,
  typeName,
  select,
  path = [],
  paths = [],
}: QueryFromInfoOptions<T>) {
  const returnType = getNamedType(info.returnType);
  const type = typeName ? info.schema.getTypeMap()[typeName] : returnType;
  const initialSelection = select
    ? {
        columns: {},
        ...select,
      }
    : undefined;

  let state: SelectionState | undefined;

  if (path.length > 0 || paths.length > 0) {
    const { pothosIndirectInclude } = (returnType.extensions ?? {}) as {
      pothosIndirectInclude?: IndirectInclude;
    };

    const matches = findIndirectSelections(
      returnType,
      info,
      info.fieldNodes[0],
      paths.length > 0
        ? paths.map((p) => p.map((n) => (typeof n === 'string' ? { name: n } : n)))
        : [path.map((n) => (typeof n === 'string' ? { name: n } : n))],
      { prefix: pothosIndirectInclude?.path, targetType: type },
    );

    if (matches.length > 0) {
      state = createStateForSelection(
        config,
        info,
        typeName ? type : matches[0].type,
        undefined,
        initialSelection,
      );

      for (const match of matches) {
        // A matched type with its own table (including variants of the target table) is walked
        // with its own field map. Types without a table (interfaces, wrappers) are walked as the
        // requested type so its fields can be found.
        const walkType = typeName && !getDrizzleModel(match.type, info) ? type : match.type;

        addTypeSelectionsForField(
          config,
          walkType,
          context,
          info,
          state,
          match.field,
          match.path,
          match.deferred,
        );
      }
    }
  } else {
    state = createStateForSelection(config, info, type, undefined, initialSelection);

    // Create initial segment for the root query field
    const rootFieldNode = info.fieldNodes[0];
    const rootField = info.parentType.getFields()[rootFieldNode.name.value];
    const initialSegments: FieldPathInfo[] = rootField
      ? [
          {
            field: rootFieldNode.name.value,
            alias: rootFieldNode.alias?.value ?? rootFieldNode.name.value,
            parentType: info.parentType.name,
            isList: isListField(rootField.type),
          },
        ]
      : [];

    addTypeSelectionsForField(
      config,
      type,
      context,
      info,
      state,
      info.fieldNodes[0],
      [],
      undefined,
      initialSegments,
    );
  }

  if (!state) {
    state = createStateForSelection(config, info, type, undefined, initialSelection);
  }

  return state;
}

export function selectionStateFromInfo(
  config: PothosDrizzleSchemaConfig,
  context: object,
  info: GraphQLResolveInfo,
  typeName?: string,
) {
  const type = typeName ? info.schema.getTypeMap()[typeName] : info.parentType;

  const state = createStateForSelection(config, info, type);

  if (!(isObjectType(type) || isInterfaceType(type))) {
    throw new PothosValidationError(
      'Drizzle plugin can only resolve selections for object and interface types',
    );
  }

  // The same response key can be selected more than once (through fragments); every occurrence
  // contributes to what the resolver will read.
  for (const fieldNode of info.fieldNodes) {
    addFieldSelection(config, type, context, info, state, fieldNode, []);
  }

  return state;
}

/**
 * Whether the field being resolved selects `path` beneath its return type, following fragments,
 * skip/include directives, and the return type's own indirect include prefix (a connection wrapped
 * by the errors plugin sits under its `data` field). It is the walk the planner uses, so a
 * resolver's view of the selection agrees with what was planned for it.
 */
export function selectsPath(info: GraphQLResolveInfo, path: string[]): boolean {
  const returnType = getNamedType(info.returnType);
  const { pothosIndirectInclude } = (returnType.extensions ?? {}) as {
    pothosIndirectInclude?: IndirectInclude;
  };
  const segments = path.map((name) => ({ name }));

  return info.fieldNodes.some(
    (node) =>
      findIndirectSelections(returnType, info, node, [segments], {
        prefix: pothosIndirectInclude?.path,
      }).length > 0,
  );
}

/** A list field, whether or not the list itself is non-null (`[Post!]!`). */
function isListField(type: GraphQLOutputType) {
  return isListType(type) || (isNonNullType(type) && isListType(type.ofType));
}

function createStateForSelection(
  config: PothosDrizzleSchemaConfig,
  info: GraphQLResolveInfo,
  type: GraphQLNamedType,
  parent?: SelectionState,
  initialSelections?: SelectionMap,
) {
  const targetType = getIndirectType(type, info);
  const { pothosDrizzleTable } = (targetType.extensions ?? {}) as {
    pothosDrizzleTable?: TableRelationalConfig;
  };

  if (!pothosDrizzleTable) {
    throw new PothosValidationError(`Expected ${targetType.name} to have a table config`);
  }

  const state = createState(
    pothosDrizzleTable,
    parent?.skipDeferredFragments ?? config.skipDeferredFragments,
    parent,
  );

  if (initialSelections) {
    mergeSelection(config, state, initialSelections);
  }

  return state;
}

function getDrizzleModel(type: GraphQLNamedType, info: GraphQLResolveInfo) {
  return getIndirectType(type, info).extensions?.pothosDrizzleModel as string | undefined;
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

export function normalizeInclude(
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
