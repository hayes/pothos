/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-continue */
import {
  FieldNode,
  getNamedType,
  GraphQLFieldMap,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  SelectionSetNode,
} from 'graphql';
import { getArgumentValues } from 'graphql/execution/values.js';
import { setLoaderMappings } from './loader-map.js';

export type IncludeMap = Record<string, unknown>;
export type LoaderMappings = Record<
  string,
  {
    field: string;
    alias?: string;
    mappings: LoaderMappings;
    indirectPath: string[];
  }
>;

interface SubFieldInclude {
  type?: string;
  name: string;
}
interface IndirectLoadMap {
  subFields: SubFieldInclude[];
  path: string[];
}

function handleField(
  info: GraphQLResolveInfo,
  fields: GraphQLFieldMap<unknown, unknown>,
  selection: FieldNode,
  includes: IncludeMap,
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

  if (indirectMap?.subFields.length) {
    const subField = indirectMap.subFields[0];

    if (field.name === subField.name && selection.selectionSet) {
      const type = getNamedType(field.type);

      if (!(type.name !== subField.type)) {
        throw new TypeError(`Expected ${field.name} to be ${subField.type} but got ${type.name}`);
      }

      includesFromSelectionSet(
        type,
        info,
        includes,
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

  const relationName = field.extensions?.giraphQLPrismaRelation as string | undefined;

  if (!relationName || includes[relationName]) {
    return;
  }

  let query = (field.extensions?.giraphQLPrismaQuery as unknown) ?? {};

  if (typeof query === 'function') {
    const args = getArgumentValues(field, selection, info.variableValues) as Record<
      string,
      unknown
    >;

    query = query(args);
  }

  const nestedMappings: LoaderMappings = {};

  mappings[relationName] = {
    field: selection.name.value,
    alias: selection.alias?.value,
    mappings: nestedMappings,
    indirectPath: indirectMap?.path ?? [],
  };

  if (selection.selectionSet) {
    const type = getNamedType(field.type);
    const nestedIncludes: Record<string, unknown> = {};

    includesFromSelectionSet(type, info, nestedIncludes, nestedMappings, selection.selectionSet);

    if (Object.keys(nestedIncludes).length > 0) {
      (query as { include?: unknown }).include = nestedIncludes;
    }
  }

  includes[relationName] = Object.keys(query as {}).length > 0 ? query : true;
}

export function includesFromSelectionSet(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  includes: Record<string, unknown>,
  mappings: LoaderMappings,
  selectionSet: SelectionSetNode,
  prevIndirectMap?: IndirectLoadMap,
) {
  const indirectInclude = type.extensions?.giraphQLPrismaIndirectInclude as
    | SubFieldInclude[]
    | undefined;

  const indirectMap = prevIndirectMap
    ? {
        path: [...prevIndirectMap.path],
        subFields:
          prevIndirectMap.subFields.length > 0 ? prevIndirectMap.subFields : indirectInclude ?? [],
      }
    : indirectInclude && { subFields: indirectInclude ?? [], path: [] };

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

        handleField(info, type.getFields(), selection, includes, mappings, indirectMap);
        break;
      case 'FragmentSpread':
        if (!info.fragments[selection.name.value]) {
          throw new Error(`Missing fragment ${selection.name.value}`);
        }

        if (info.fragments[selection.name.value].typeCondition.name.value !== expectedType.name) {
          continue;
        }

        includesFromSelectionSet(
          expectedType,
          info,
          includes,
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
          selection.typeCondition ? expectedType : type,
          info,
          includes,
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

  const includes: IncludeMap = {};
  const mappings: LoaderMappings = {};
  for (const node of fieldNodes) {
    if (!node.selectionSet) {
      continue;
    }

    const type = typeName ? info.schema.getTypeMap()[typeName] : getNamedType(info.returnType);

    includesFromSelectionSet(type, info, includes, mappings, node.selectionSet);
  }

  if (Object.keys(includes).length > 0) {
    if (mappings) {
      setLoaderMappings(ctx, info.path, mappings);
    }

    return { include: includes };
  }

  return {};
}
