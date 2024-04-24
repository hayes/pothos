/* eslint-disable no-continue */
import { TableRelationalConfig, TablesRelationalConfig } from 'drizzle-orm';
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
import { type DrizzleFieldSelection } from '../types';
import { LoaderMappings, setLoaderMappings } from './loader-map';
import {
  createState,
  mergeSelection,
  selectionCompatible,
  SelectionMap,
  SelectionState,
  selectionToQuery,
} from './selections';

export interface IndirectInclude {
  getType: () => string;
  path?: { type?: string; name: string }[];
  paths?: { type?: string; name: string }[][];
}

function addTypeSelectionsForField(
  schema: TablesRelationalConfig,
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

  const { pothosDrizzleSelect, pothosDrizzleIndirectInclude } = (type.extensions ?? {}) as {
    pothosDrizzleIndirectInclude?: IndirectInclude;
    pothosDrizzleSelect?: SelectionMap;
  };

  if (
    (!!pothosDrizzleIndirectInclude?.path && pothosDrizzleIndirectInclude.path.length > 0) ||
    (!!pothosDrizzleIndirectInclude?.paths && pothosDrizzleIndirectInclude.paths.length === 0)
  ) {
    resolveIndirectIncludePaths(
      type,
      info,
      selection,
      [],
      pothosDrizzleIndirectInclude.paths ?? [pothosDrizzleIndirectInclude.path!],
      indirectPath,
      (resolvedType, field, path) => {
        addTypeSelectionsForField(schema, resolvedType, context, info, state, field, path);
      },
    );
  } else if (pothosDrizzleIndirectInclude) {
    addTypeSelectionsForField(
      schema,
      info.schema.getType(pothosDrizzleIndirectInclude.getType())!,
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

  if (pothosDrizzleSelect) {
    mergeSelection(schema, state, { ...pothosDrizzleSelect });
  }

  if (selection.selectionSet) {
    addNestedSelections(schema, type, context, info, state, selection.selectionSet, indirectPath);
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
        if (
          !include.type ||
          info.fragments[sel.name.value].typeCondition.name.value === include.type
        ) {
          resolveIndirectInclude(
            include.type ? info.schema.getType(include.type)! : type,
            info,
            info.fragments[sel.name.value],
            includePath,
            path,
            resolve,
          );
        }

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
  schema: TablesRelationalConfig,
  type: GraphQLInterfaceType | GraphQLObjectType,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selections: SelectionSetNode,
  indirectPath: string[],
) {
  let parentType = type;
  for (const selection of selections.selections) {
    switch (selection.kind) {
      case Kind.FIELD:
        addFieldSelection(schema, type, context, info, state, selection, indirectPath);

        continue;
      case Kind.FRAGMENT_SPREAD:
        parentType = info.schema.getType(
          info.fragments[selection.name.value].typeCondition.name.value,
        )! as GraphQLObjectType;
        if (
          isObjectType(type)
            ? parentType.name !== type.name
            : parentType.extensions?.pothosDrizzleModel !== type.extensions.pothosDrizzleModel
        ) {
          continue;
        }

        addNestedSelections(
          schema,
          parentType,
          context,
          info,
          state,
          info.fragments[selection.name.value].selectionSet,
          indirectPath,
        );

        continue;

      case Kind.INLINE_FRAGMENT:
        parentType = selection.typeCondition
          ? (info.schema.getType(selection.typeCondition.name.value) as GraphQLObjectType)
          : type;
        if (
          isObjectType(type)
            ? parentType.name !== type.name
            : parentType.extensions?.pothosDrizzleModel !== type.extensions.pothosDrizzleModel
        ) {
          continue;
        }

        addNestedSelections(
          schema,
          parentType,
          context,
          info,
          state,
          selection.selectionSet,
          indirectPath,
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
  schema: TablesRelationalConfig,
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

  const fieldSelect = field.extensions?.pothosDrizzleSelect as DrizzleFieldSelection | undefined;

  let fieldSelectionMap: SelectionMap | undefined;
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
        const fieldState = createStateForSelection(schema, returnType, state);
        if (typeof query === 'object' && Object.keys(query).length > 0) {
          mergeSelection(schema, fieldState, { columns: {}, ...query });
        }
        if (
          (!!normalizedIndirectInclude?.path && normalizedIndirectInclude.path.length > 0) ||
          (!!normalizedIndirectInclude?.paths && normalizedIndirectInclude.paths.length > 0)
        ) {
          resolveIndirectIncludePaths(
            returnType,
            info,
            selection,
            (returnType.extensions?.pothosDrizzleIndirectInclude as { path: [] })?.path ?? [],
            normalizedIndirectInclude.paths ?? [normalizedIndirectInclude.path!],
            [],
            (resolvedType, resolvedField, path) => {
              addTypeSelectionsForField(
                schema,
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
        addTypeSelectionsForField(schema, returnType, context, info, fieldState, selection, []);
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
    fieldSelectionMap = fieldSelect!;
  }

  if (fieldSelect && selectionCompatible(state, fieldSelectionMap, true)) {
    mergeSelection(schema, state, fieldSelectionMap);
    // eslint-disable-next-line no-param-reassign
    state.mappings[selection.alias?.value ?? selection.name.value] = {
      field: selection.name.value,
      type: type.name,
      mappings,
      indirectPath,
    };
  }
}

export function queryFromInfo<T extends SelectionMap | undefined = undefined>({
  schema,
  context,
  info,
  typeName,
  select,
  path = [],
  paths = [],
  withUsageCheck = false,
}: {
  schema: TablesRelationalConfig;
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

  if (path.length > 0 || paths.length > 0) {
    const { pothosDrizzleIndirectInclude } = (returnType.extensions ?? {}) as {
      pothosDrizzleIndirectInclude?: IndirectInclude;
    };

    resolveIndirectInclude(
      returnType,
      info,
      info.fieldNodes[0],
      pothosDrizzleIndirectInclude?.path ?? [],
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
            state = createStateForSelection(schema, resolvedType, undefined, select);

            addTypeSelectionsForField(
              schema,
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
    state = createStateForSelection(schema, type, undefined, select);

    addTypeSelectionsForField(schema, type, context, info, state, info.fieldNodes[0], []);
  }

  if (!state) {
    state = createStateForSelection(schema, type, undefined, select);
  }

  setLoaderMappings(context, info, state.mappings);

  const query = selectionToQuery(state) as { select: T };

  return query;
  // return withUsageCheck ? wrapWithUsageCheck(query) : query;
}

export function selectionStateFromInfo(
  schema: TablesRelationalConfig,
  context: object,
  info: GraphQLResolveInfo,
  typeName?: string,
) {
  const type = typeName ? info.schema.getTypeMap()[typeName] : info.parentType;

  const state = createStateForSelection(schema, type);

  if (!(isObjectType(type) || isInterfaceType(type))) {
    throw new PothosValidationError(
      'Drizzle plugin can only resolve selections for object and interface types',
    );
  }

  addFieldSelection(schema, type, context, info, state, info.fieldNodes[0], []);

  return state;
}

function createStateForSelection(
  schema: TablesRelationalConfig,
  type: GraphQLNamedType,
  parent?: SelectionState,
  initialSelections?: SelectionMap,
) {
  const { pothosDrizzleTable } = (type.extensions ?? {}) as {
    pothosDrizzleTable?: TableRelationalConfig;
  };

  if (!pothosDrizzleTable) {
    throw new PothosValidationError(`Expected ${type.name} to have a table config`);
  }

  const state = createState(pothosDrizzleTable, parent);

  if (initialSelections) {
    mergeSelection(schema, state, initialSelections);
  }

  return state;
}

export function getIndirectType(type: GraphQLNamedType, info: GraphQLResolveInfo) {
  let targetType = type;

  while (targetType.extensions?.pothosDrizzleIndirectInclude) {
    targetType = info.schema.getType(
      (targetType.extensions?.pothosDrizzleIndirectInclude as IndirectInclude).getType(),
    )!;
  }

  return targetType;
}

export function normalizeInclude(path: string[], type: GraphQLNamedType): IndirectInclude {
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
