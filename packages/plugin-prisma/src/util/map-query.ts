/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
import {
  FieldNode,
  FragmentDefinitionNode,
  getArgumentValues,
  getDirectiveValues,
  getNamedType,
  GraphQLField,
  GraphQLIncludeDirective,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLSkipDirective,
  InlineFragmentNode,
  isInterfaceType,
  isObjectType,
  Kind,
  SelectionSetNode,
} from 'graphql';
import { PothosValidationError } from '@pothos/core';
import {
  FieldSelection,
  IncludeMap,
  IndirectInclude,
  LoaderMappings,
  SelectionMap,
} from '../types';
import { setLoaderMappings } from './loader-map';
import { FieldMap } from './relation-map';
import {
  createState,
  mergeSelection,
  selectionCompatible,
  SelectionState,
  selectionToQuery,
} from './selections';
import { wrapWithUsageCheck } from './usage';

function addTypeSelectionsForField(
  type: GraphQLNamedType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
) {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const {
    pothosPrismaInclude,
    pothosPrismaSelect,
    pothosPrismaIndirectInclude,
    pothosPrismaModel,
  } = (type.extensions ?? {}) as {
    pothosPrismaModel?: string;
    pothosPrismaInclude?: IncludeMap;
    pothosPrismaSelect?: IncludeMap;
    pothosPrismaIndirectInclude?: IndirectInclude;
  };

  if (
    (!!pothosPrismaIndirectInclude?.path && pothosPrismaIndirectInclude.path.length > 0) ||
    (!!pothosPrismaIndirectInclude?.paths && pothosPrismaIndirectInclude.paths.length === 0)
  ) {
    resolveIndirectIncludePaths(
      type,
      info,
      selection,
      [],
      pothosPrismaIndirectInclude.paths ?? [pothosPrismaIndirectInclude.path!],
      indirectPath,
      (resolvedType, field, path) => {
        addTypeSelectionsForField(resolvedType, context, info, state, field, path);
      },
    );
  } else if (pothosPrismaIndirectInclude) {
    addTypeSelectionsForField(
      info.schema.getType(pothosPrismaIndirectInclude.getType())!,
      context,
      info,
      state,
      selection,
      indirectPath,
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

  if (selection.selectionSet) {
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
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[]) => void,
) {
  for (const includePath of includePaths) {
    if (pathPrefix.length > 0) {
      resolveIndirectInclude(type, info, selection, [...pathPrefix, ...includePath], path, resolve);
    } else {
      resolveIndirectInclude(type, info, selection, includePath, path, resolve);
    }
  }
}

function resolveIndirectInclude(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  includePath: { type?: string; name: string }[],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[]) => void,
  expectedType = type,
) {
  if (includePath.length === 0) {
    resolve(type, selection as FieldNode, path);
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
          );
        }
        continue;
      case Kind.FRAGMENT_SPREAD:
        resolveIndirectInclude(
          info.schema.getType(info.fragments[sel.name.value].typeCondition.name.value)!,
          info,
          info.fragments[sel.name.value],
          includePath,
          path,
          resolve,
          include.type ? info.schema.getType(include.type)! : expectedType,
        );

        continue;

      case Kind.INLINE_FRAGMENT:
        if (!sel.typeCondition || !include.type || sel.typeCondition.name.value === include.type) {
          resolveIndirectInclude(
            sel.typeCondition ? info.schema.getType(sel.typeCondition.name.value)! : type,
            info,
            sel,
            includePath,
            path,
            resolve,
            include.type ? info.schema.getType(include.type)! : expectedType,
          );
        }

        continue;

      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(selection as { kind: string }).kind}`,
        );
    }
  }
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
    const args = getArgumentValues(field, selection, info.variableValues) as Record<
      string,
      unknown
    >;

    fieldSelectionMap = fieldSelect(
      args,
      context,
      (rawQuery, indirectInclude) => {
        const returnType = getNamedType(field.type);
        const query = typeof rawQuery === 'function' ? rawQuery(args, context) : rawQuery;

        const normalizedIndirectInclude = Array.isArray(indirectInclude)
          ? normalizeInclude(indirectInclude, getIndirectType(returnType, info))
          : indirectInclude;

        const fieldState = createStateForType(
          getIndirectType(
            normalizedIndirectInclude
              ? info.schema.getType(normalizedIndirectInclude.getType())!
              : returnType,
            info,
          ),
          info,
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
            (returnType.extensions?.pothosPrismaIndirectInclude as { path: [] })?.path ?? [],
            normalizedIndirectInclude.paths ?? [normalizedIndirectInclude.path!],
            [],
            (resolvedType, resolvedField, path) => {
              addTypeSelectionsForField(
                resolvedType,
                context,
                info,
                fieldState,
                resolvedField,
                path,
              );
            },
          );
        }

        addTypeSelectionsForField(returnType, context, info, fieldState, selection, []);

        // eslint-disable-next-line prefer-destructuring
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
    state.mappings[selection.alias?.value ?? selection.name.value] = {
      field: selection.name.value,
      type: type.name,
      mappings,
      indirectPath,
    };
  }
}

export function queryFromInfo<T extends SelectionMap['select'] | undefined = undefined>({
  context,
  info,
  typeName,
  select,
  path = [],
  paths = [],
  withUsageCheck = false,
}: {
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  select?: T;
  path?: string[];
  paths?: string[][];
  withUsageCheck?: boolean;
}): { include?: {} } | { select: T } {
  const returnType = getNamedType(info.returnType);
  const type = typeName ? info.schema.getTypeMap()[typeName] : returnType;

  let state: SelectionState | undefined;
  const initialSelection = select ? { select } : undefined;

  if (path.length > 0 || paths.length > 0) {
    const { pothosPrismaIndirectInclude } = (returnType.extensions ?? {}) as {
      pothosPrismaIndirectInclude?: IndirectInclude;
    };

    resolveIndirectInclude(
      returnType,
      info,
      info.fieldNodes[0],
      pothosPrismaIndirectInclude?.path ?? [],
      [],
      (indirectType, indirectField, subPath) => {
        resolveIndirectIncludePaths(
          indirectType,
          info,
          indirectField,
          [],
          paths.length > 0
            ? paths.map((p) => p.map((n) => (typeof n === 'string' ? { name: n } : n)))
            : [path.map((n) => (typeof n === 'string' ? { name: n } : n))],
          subPath,
          (resolvedType, resolvedField, nested) => {
            state = createStateForType(
              typeName ? type : resolvedType,
              info,
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
            );
          },
        );
      },
    );
  } else {
    state = createStateForType(type, info, undefined, initialSelection);

    addTypeSelectionsForField(type, context, info, state, info.fieldNodes[0], []);
  }

  if (!state) {
    state = createStateForType(type, info, undefined, initialSelection);
  }

  setLoaderMappings(context, info, state.mappings);

  const query = selectionToQuery(state) as { select: T };

  return withUsageCheck ? wrapWithUsageCheck(query) : query;
}

export function selectionStateFromInfo(
  context: object,
  info: GraphQLResolveInfo,
  typeName?: string,
) {
  const type = typeName ? info.schema.getTypeMap()[typeName] : info.parentType;

  const state = createStateForType(type, info);

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
  parent?: SelectionState,
  initialSelections?: SelectionMap,
) {
  const targetType = getIndirectType(type, info);

  const fieldMap = targetType.extensions?.pothosPrismaFieldMap as FieldMap;

  const state = createState(
    fieldMap,
    targetType.extensions?.pothosPrismaSelect ? 'select' : 'include',
    parent,
  );

  if (initialSelections) {
    mergeSelection(state, initialSelections);
  }

  return state;
}

export function getIndirectType(type: GraphQLNamedType, info: GraphQLResolveInfo) {
  let targetType = type;

  while (targetType.extensions?.pothosPrismaIndirectInclude) {
    targetType = info.schema.getType(
      (targetType.extensions?.pothosPrismaIndirectInclude as IndirectInclude).getType(),
    )!;
  }

  return targetType;
}

function normalizeInclude(path: string[], type: GraphQLNamedType): IndirectInclude {
  let currentType = type;

  const normalized: { name: string; type: string }[] = [];

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

    normalized.push({ name: fieldName, type: currentType.name });
  }

  return {
    getType: () => (normalized.length > 0 ? normalized[normalized.length - 1].type : type.name),
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
