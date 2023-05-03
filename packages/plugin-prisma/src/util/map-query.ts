/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
import {
  FieldNode,
  FragmentDefinitionNode,
  getArgumentValues,
  getNamedType,
  GraphQLField,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  InlineFragmentNode,
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

  if (pothosPrismaIndirectInclude && pothosPrismaIndirectInclude.path.length > 0) {
    resolveIndirectInclude(
      type,
      info,
      selection,
      pothosPrismaIndirectInclude.path,
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

  if (!isObjectType(type)) {
    return;
  }

  if (pothosPrismaModel && !pothosPrismaSelect) {
    state.mode = 'include';
  }

  if (pothosPrismaInclude || pothosPrismaSelect) {
    mergeSelection(state, {
      select: pothosPrismaSelect ? { ...pothosPrismaSelect } : undefined,
      include: pothosPrismaInclude ? { ...pothosPrismaInclude } : undefined,
    });
  }

  if (selection.selectionSet) {
    addNestedSelections(type, context, info, state, selection.selectionSet, indirectPath);
  }
}

function resolveIndirectInclude(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  includePath: IndirectInclude['path'],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[]) => void,
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
        if (sel.name.value === include.name && isObjectType(type)) {
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
        if (info.fragments[sel.name.value].typeCondition.name.value === include.type) {
          resolveIndirectInclude(
            info.schema.getType(include.type)!,
            info,
            info.fragments[sel.name.value],
            includePath,
            path,
            resolve,
          );
        }

        continue;

      case Kind.INLINE_FRAGMENT:
        if (!sel.typeCondition || sel.typeCondition.name.value === include.type) {
          resolveIndirectInclude(
            sel.typeCondition ? info.schema.getType(sel.typeCondition.name.value)! : type,
            info,
            sel,
            includePath,
            path,
            resolve,
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
  type: GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selections: SelectionSetNode,
  indirectPath: string[],
) {
  for (const selection of selections.selections) {
    switch (selection.kind) {
      case Kind.FIELD:
        addFieldSelection(type, context, info, state, selection, indirectPath);

        continue;
      case Kind.FRAGMENT_SPREAD:
        if (info.fragments[selection.name.value].typeCondition.name.value !== type.name) {
          continue;
        }

        addNestedSelections(
          type,
          context,
          info,
          state,
          info.fragments[selection.name.value].selectionSet,
          indirectPath,
        );

        continue;

      case Kind.INLINE_FRAGMENT:
        if (selection.typeCondition && selection.typeCondition.name.value !== type.name) {
          continue;
        }

        addNestedSelections(type, context, info, state, selection.selectionSet, indirectPath);

        continue;

      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(selection as { kind: string }).kind}`,
        );
    }
  }
}

function addFieldSelection(
  type: GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
) {
  if (selection.name.value.startsWith('__')) {
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

        if (normalizedIndirectInclude && normalizedIndirectInclude.path.length > 0) {
          resolveIndirectInclude(
            returnType,
            info,
            selection,
            [
              ...((returnType.extensions?.pothosPrismaIndirectInclude as { path: [] })?.path ?? []),
              ...normalizedIndirectInclude.path,
            ],
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
}: {
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  select?: T;
  path?: string[];
}): { select: T } | { include?: {} } {
  const returnType = getNamedType(info.returnType);
  const type = typeName ? info.schema.getTypeMap()[typeName] : returnType;

  let state: SelectionState | undefined;
  const initialSelection = select ? { select } : undefined;

  if (path.length > 0) {
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
        resolveIndirectInclude(
          indirectType,
          info,
          indirectField,
          path.map((n) => (typeof n === 'string' ? { name: n } : n)),
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

  return selectionToQuery(state) as { select: T };
}

export function selectionStateFromInfo(
  context: object,
  info: GraphQLResolveInfo,
  typeName?: string,
) {
  const type = typeName ? info.schema.getTypeMap()[typeName] : info.parentType;

  const state = createStateForType(type, info);

  if (!isObjectType(type)) {
    throw new PothosValidationError('Prisma plugin can only resolve includes for object types');
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

function normalizeInclude(path: string[], type: GraphQLNamedType) {
  let currentType = type;

  const normalized: { name: string; type: string }[] = [];

  if (!isObjectType(currentType)) {
    throw new PothosValidationError(`Expected ${currentType} to be an Object type`);
  }

  for (const fieldName of path) {
    const field: GraphQLField<unknown, unknown> = currentType.getFields()[fieldName];

    if (!field) {
      throw new PothosValidationError(`Expected ${currentType} to have a field ${fieldName}`);
    }

    currentType = getNamedType(field.type);

    if (!isObjectType(currentType)) {
      throw new PothosValidationError(`Expected ${currentType} to be an Object type`);
    }

    normalized.push({ name: fieldName, type: currentType.name });
  }

  return {
    getType: () => (normalized.length > 0 ? normalized[normalized.length - 1].type : type.name),
    path: normalized,
  };
}
