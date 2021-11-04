/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  FieldNode,
  getNamedType,
  GraphQLFieldMap,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  SelectionSetNode,
} from 'graphql';
import { getArgumentValues } from 'graphql/execution/values';
import { setLoaderMappings } from '../loader-map';
import {
  IncludeCounts,
  IncludeMap,
  IndirectLoadMap,
  LoaderMappings,
  SubFieldInclude,
} from '../types';
import { mergeIncludes, resolveIndirectType } from '.';

function handleField(
  ctx: object,
  info: GraphQLResolveInfo,
  fields: GraphQLFieldMap<unknown, unknown>,
  selection: FieldNode,
  includes: IncludeMap,
  counts: IncludeCounts,
  mappings: LoaderMappings,
  indirectMap?: IndirectLoadMap,
) {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const field = fields[selection.name.value];

  if (!field) {
    throw new Error(`Unknown field ${selection.name.value}`);
  }

  const countName = field.extensions?.giraphQLPrismaRelationCount as string | undefined;
  const parentCountName = field.extensions?.giraphQLPrismaRelationCountForParent as
    | string
    | undefined;
  const relationName = field.extensions?.giraphQLPrismaRelation as string | undefined;

  if (countName) {
    counts.current[countName] = true;
  }

  if (parentCountName) {
    counts.parent[parentCountName] = true;
  }

  if (indirectMap?.subFields.length) {
    const subField = indirectMap.subFields[0];

    if (field.name === subField.name && selection.selectionSet) {
      const type = getNamedType(field.type);

      if (!(type.name !== subField.type)) {
        throw new TypeError(`Expected ${field.name} to be ${subField.type} but got ${type.name}`);
      }

      includesFromSelectionSet(
        ctx,
        type,
        info,
        includes,
        counts,
        mappings,
        selection.selectionSet,
        indirectMap.subFields.length > 0
          ? {
              subFields: indirectMap.subFields.slice(1),
              path: [...indirectMap.path, selection.alias?.value ?? selection.name.value],
            }
          : undefined,
      );
    }

    return;
  }

  if (!relationName) {
    return;
  }

  const type = getNamedType(field.type);
  const includeType = resolveIndirectType(type, info);

  const newIncludes: IncludeMap = {
    ...(includeType.extensions?.giraphqlPrismaInclude as IncludeMap),
  };

  let query = field.extensions?.giraphQLPrismaQuery ?? {};

  if (typeof query === 'function') {
    const args = getArgumentValues(field, selection, info.variableValues) as Record<
      string,
      unknown
    >;

    query = query(args, ctx);
  }

  const existingInclude = includes[relationName];

  query = { ...(query as {}), include: newIncludes };

  if (typeof existingInclude === 'object') {
    query = mergeIncludes(existingInclude, query as Record<string, unknown>);

    if (!query) {
      return;
    }
  }

  const nestedIncludes = (query as { include: IncludeMap }).include;
  const nestedMappings: LoaderMappings = {};
  const nestedCounts: IncludeCounts = {
    current: {},
    parent: counts.current,
  };

  if (!mappings[relationName]) {
    mappings[relationName] = [];
  }

  mappings[relationName].push({
    field: selection.name.value,
    alias: selection.alias?.value,
    mappings: nestedMappings,
    indirectPath: indirectMap?.path ?? [],
  });

  if (selection.selectionSet) {
    includesFromSelectionSet(
      ctx,
      type,
      info,
      nestedIncludes,
      nestedCounts,
      nestedMappings,
      selection.selectionSet,
    );
  }

  if (Object.keys(nestedCounts.current).length > 0) {
    nestedIncludes._count = { select: nestedCounts.current };
  }

  if (Object.keys(nestedIncludes).length === 0) {
    delete (query as { include?: unknown }).include;
  }

  includes[relationName] =
    Object.keys(query as {}).length > 0 ? (query as Record<string, unknown>) : true;
}

export function includesFromSelectionSet(
  ctx: object,
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  includes: IncludeMap,
  counts: IncludeCounts,
  mappings: LoaderMappings,
  selectionSet: SelectionSetNode,
  prevIndirectMap?: IndirectLoadMap,
) {
  const indirectInclude = type.extensions?.giraphQLPrismaIndirectInclude as
    | { path: SubFieldInclude[] }
    | undefined;

  const indirectMap = prevIndirectMap
    ? {
        path: [...prevIndirectMap.path],
        subFields:
          prevIndirectMap.subFields.length > 0
            ? prevIndirectMap.subFields
            : indirectInclude?.path ?? [],
      }
    : indirectInclude && { subFields: indirectInclude.path ?? [], path: [] };

  const firstSubFieldType =
    indirectMap &&
    indirectMap?.subFields.length > 0 &&
    indirectMap.subFields?.length > 0 &&
    indirectMap.subFields[0].type;

  const expectedType = firstSubFieldType ? info.schema.getType(firstSubFieldType) : type;

  if (!(expectedType instanceof GraphQLObjectType)) {
    throw new TypeError('Expected returnType to be an object type');
  }

  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case 'Field':
        if (!(type === expectedType)) {
          continue;
        }

        handleField(
          ctx,
          info,
          type.getFields(),
          selection,
          includes,
          counts,
          mappings,
          indirectMap,
        );
        break;
      case 'FragmentSpread':
        if (!info.fragments[selection.name.value]) {
          throw new Error(`Missing fragment ${selection.name.value}`);
        }

        if (info.fragments[selection.name.value].typeCondition.name.value !== expectedType.name) {
          continue;
        }

        includesFromSelectionSet(
          ctx,
          expectedType,
          info,
          includes,
          counts,
          mappings,
          info.fragments[selection.name.value].selectionSet,
          indirectMap,
        );
        break;
      case 'InlineFragment':
        if (selection.typeCondition && selection.typeCondition.name.value !== expectedType.name) {
          continue;
        }

        includesFromSelectionSet(
          ctx,
          selection.typeCondition ? expectedType : type,
          info,
          includes,
          counts,
          mappings,
          selection.selectionSet,
          indirectMap,
        );
        break;
      default:
        throw new Error(`Unexpected selection kind ${(selection as { kind: string }).kind}`);
    }
  }
}

export function queryFromInfo(ctx: object, info: GraphQLResolveInfo, typeName?: string): {} {
  const { fieldNodes } = info;
  const includeType = resolveIndirectType(getNamedType(info.returnType), info);

  const includes: IncludeMap = {
    ...(includeType.extensions?.giraphqlPrismaInclude as IncludeMap),
  };

  const counts = {
    parent: {},
    current: {},
  };

  const mappings: LoaderMappings = {};
  for (const node of fieldNodes) {
    if (!node.selectionSet) {
      continue;
    }

    const type = typeName ? info.schema.getTypeMap()[typeName] : getNamedType(info.returnType);

    includesFromSelectionSet(ctx, type, info, includes, counts, mappings, node.selectionSet);
  }

  if (Object.keys(counts.current).length > 0) {
    includes._count = { select: counts.current };
  }

  if (Object.keys(includes).length > 0) {
    if (mappings) {
      setLoaderMappings(ctx, info.path, mappings);
    }

    return { include: includes };
  }

  return {};
}
