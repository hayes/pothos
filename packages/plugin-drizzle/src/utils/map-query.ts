import { PothosValidationError, getMappedArgumentValues } from '@pothos/core';
import type { DBQueryConfig, TableRelationalConfig } from 'drizzle-orm';
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
  type InlineFragmentNode,
  Kind,
  type SelectionSetNode,
  getDirectiveValues,
  getNamedType,
  isInterfaceType,
  isObjectType,
} from 'graphql';
import type { DrizzleFieldSelection } from '../types';
import type { PothosDrizzleSchemaConfig } from './config';
import { type LoaderMappings, setLoaderMappings } from './loader-map';
import {
  type SelectionMap,
  type SelectionState,
  createState,
  mergeSelection,
  selectionCompatible,
  selectionToQuery,
} from './selections';
import { wrapWithUsageCheck } from './usage';

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
) {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const { pothosDrizzleSelect, pothosIndirectInclude } = (type.extensions ?? {}) as {
    pothosIndirectInclude?: IndirectInclude;
    pothosDrizzleSelect?: DBQueryConfig<'one', false>;
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
      (resolvedType, field, path) => {
        addTypeSelectionsForField(
          config,
          resolvedType,
          context,
          info,
          state,
          field,
          path,
          deferred,
        );
      },
      deferred,
    );
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
    );
    return;
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return;
  }

  if (pothosDrizzleSelect) {
    mergeSelection(config, state, { ...pothosDrizzleSelect });
  }

  if (selection.selectionSet && (!deferred || !state.skipDeferredFragments)) {
    addNestedSelections(config, type, context, info, state, selection.selectionSet, indirectPath);
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
  deferred?: boolean,
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
            deferred || isDeferredFragment(sel, info),
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
            deferred || isDeferredFragment(sel, info),
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
  config: PothosDrizzleSchemaConfig,
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
        addFieldSelection(config, type, context, info, state, selection, indirectPath);

        continue;
      case Kind.FRAGMENT_SPREAD:
        if (state.skipDeferredFragments && isDeferredFragment(selection, info)) {
          continue;
        }

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
          config,
          parentType,
          context,
          info,
          state,
          info.fragments[selection.name.value].selectionSet,
          indirectPath,
        );

        continue;

      case Kind.INLINE_FRAGMENT:
        if (state.skipDeferredFragments && isDeferredFragment(selection, info)) {
          continue;
        }

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
          config,
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
  config: PothosDrizzleSchemaConfig,
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

  let fieldSelectionMap: DBQueryConfig<'one', false> | undefined;
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
        const fieldState = createStateForSelection(
          config,
          info,
          normalizedIndirectInclude
            ? info.schema.getType(normalizedIndirectInclude.getType())!
            : returnType,
          state,
        );

        if (typeof query === 'object' && Object.keys(query).length > 0) {
          mergeSelection(config, fieldState, { columns: {}, ...query });
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
            normalizedIndirectInclude.paths ?? [normalizedIndirectInclude.path!],
            [],
            (resolvedType, resolvedField, path, deferred) => {
              addTypeSelectionsForField(
                config,
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
        }
        addTypeSelectionsForField(config, returnType, context, info, fieldState, selection, []);
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
    mergeSelection(config, state, fieldSelectionMap);
    state.mappings[selection.alias?.value ?? selection.name.value] = {
      field: selection.name.value,
      type: type.name,
      mappings,
      indirectPath,
    };
  }
}

export interface QueryFromInfoOptions<T extends SelectionMap> {
  config: PothosDrizzleSchemaConfig;
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  select?: T;
  path?: string[];
  paths?: string[][];
  withUsageCheck?: boolean;
}

export function queryFromInfo<T extends SelectionMap>({
  withUsageCheck,
  ...options
}: QueryFromInfoOptions<T>): T {
  const state = stateFromInfo(options);

  setLoaderMappings(options.context, options.info, state.mappings);

  const query = selectionToQuery(state) as T;

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

  let state: SelectionState | undefined;

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
            state = createStateForSelection(config, info, resolvedType, undefined, select);

            addTypeSelectionsForField(
              config,
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
    state = createStateForSelection(config, info, type, undefined, select);

    addTypeSelectionsForField(config, type, context, info, state, info.fieldNodes[0], []);
  }

  if (!state) {
    state = createStateForSelection(config, info, type, undefined, select);
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

  addFieldSelection(config, type, context, info, state, info.fieldNodes[0], []);

  return state;
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

export function getIndirectType(type: GraphQLNamedType, info: GraphQLResolveInfo) {
  let targetType = type;

  while (targetType.extensions?.pothosIndirectInclude) {
    targetType = info.schema.getType(
      (targetType.extensions?.pothosIndirectInclude as IndirectInclude).getType(),
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
    getType: () =>
      expectedType?.name ??
      (normalized.length > 0 ? normalized[normalized.length - 1].type : type.name),
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
