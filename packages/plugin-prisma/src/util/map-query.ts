/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
import {
  FieldNode,
  FragmentDefinitionNode,
  getNamedType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  InlineFragmentNode,
  isObjectType,
  Kind,
  SelectionSetNode,
} from 'graphql';
import { getArgumentValues } from 'graphql/execution/values';
import { setLoaderMappings } from './loader-map';
import { FieldMap } from './relation-map';
import {
  createState,
  mergeSelection,
  selectionCompatible,
  SelectionState,
  selectionToQuery,
} from './selections';

import { FieldSelection, IncludeMap, IndirectInclude, LoaderMappings, SelectionMap } from '..';

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

  if (pothosPrismaIndirectInclude) {
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
  const [include, ...rest] = includePath;
  if (!selection.selectionSet || !include) {
    return;
  }

  for (const sel of selection.selectionSet.selections) {
    switch (sel.kind) {
      case Kind.FIELD:
        if (sel.name.value === include.name && isObjectType(type)) {
          const returnType = getNamedType(type.getFields()[sel.name.value].type);

          if (rest.length === 0) {
            resolve(returnType, sel, [...path, sel.alias?.value ?? sel.name.value]);
          } else {
            resolveIndirectInclude(
              returnType,
              info,
              sel,
              rest,
              [...path, sel.alias?.value ?? sel.name.value],
              resolve,
            );
          }
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
        throw new Error(`Unsupported selection kind ${(selection as { kind: string }).kind}`);
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
        throw new Error(`Unsupported selection kind ${(selection as { kind: string }).kind}`);
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
    throw new Error(`Unknown field ${selection.name.value} on ${type.name}`);
  }

  const fieldSelect = field.extensions?.pothosPrismaSelect as FieldSelection | undefined;

  let fieldSelectionMap: SelectionMap;

  const fieldParentSelect = field.extensions?.pothosPrismaParentSelect as
    | Record<string, SelectionMap | boolean>
    | undefined;
  let mappings: LoaderMappings = {};

  if (typeof fieldSelect === 'function') {
    const args = getArgumentValues(field, selection, info.variableValues) as Record<
      string,
      unknown
    >;

    fieldSelectionMap = fieldSelect(args, context, (rawQuery) => {
      const returnType = getNamedType(field.type);
      const query = typeof rawQuery === 'function' ? rawQuery(args, context) : rawQuery;

      const fieldState = createStateForType(returnType, info, state);

      if (typeof query === 'object' && Object.keys(query).length > 0) {
        mergeSelection(fieldState, { select: {}, ...query });
      }

      addTypeSelectionsForField(returnType, context, info, fieldState, selection, []);

      // eslint-disable-next-line prefer-destructuring
      mappings = fieldState.mappings;

      return selectionToQuery(fieldState);
    });
  } else {
    fieldSelectionMap = { select: fieldSelect };
  }

  if (fieldSelect && selectionCompatible(state, fieldSelectionMap, true)) {
    mergeSelection(state, fieldSelectionMap);
    state.mappings[selection.alias?.value ?? selection.name.value] = {
      field: selection.name.value,
      mappings,
      indirectPath,
    };
  } else if (
    fieldParentSelect &&
    state.parent &&
    selectionCompatible(state.parent, { select: fieldParentSelect }, true)
  ) {
    mergeSelection(state.parent, { select: fieldParentSelect });
    state.mappings[selection.alias?.value ?? selection.name.value] = {
      field: selection.name.value,
      mappings,
      indirectPath,
    };
  }
}

export function queryFromInfo(context: object, info: GraphQLResolveInfo, typeName?: string): {} {
  const type = typeName ? info.schema.getTypeMap()[typeName] : getNamedType(info.returnType);
  const state = createStateForType(type, info);

  addTypeSelectionsForField(type, context, info, state, info.fieldNodes[0], []);

  setLoaderMappings(context, info.path, state.mappings);

  return selectionToQuery(state);
}

export function selectionStateFromInfo(
  context: object,
  info: GraphQLResolveInfo,
  typeName?: string,
) {
  const type = typeName ? info.schema.getTypeMap()[typeName] : info.parentType;

  const state = createStateForType(type, info);

  if (!isObjectType(type)) {
    throw new Error('Prisma plugin can only resolve includes for object types');
  }

  addFieldSelection(type, context, info, state, info.fieldNodes[0], []);

  return state;
}

function createStateForType(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  parent?: SelectionState,
) {
  let targetType = type;

  while (targetType.extensions.pothosPrismaIndirectInclude) {
    targetType = info.schema.getType(
      (targetType.extensions.pothosPrismaIndirectInclude as IndirectInclude).getType(),
    )!;
  }

  const fieldMap = targetType.extensions.pothosPrismaFieldMap as FieldMap;

  return createState(
    fieldMap,
    targetType.extensions.pothosPrismaSelect ? 'select' : 'include',
    parent,
  );
}
