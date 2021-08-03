/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-continue */
import {
  FieldNode,
  FragmentDefinitionNode,
  getNamedType,
  GraphQLFieldMap,
  GraphQLObjectType,
  GraphQLResolveInfo,
  InlineFragmentNode,
  SelectionSetNode,
} from 'graphql';
import { getArgumentValues } from 'graphql/execution/values';
import { setLoaderMappings } from './loader-map';

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

interface IndirectLoadMap {
  subFields: string[];
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
    if (field.name === indirectMap.subFields[0] && selection.selectionSet) {
      const type = getNamedType(field.type);

      if (!(type instanceof GraphQLObjectType)) {
        throw new TypeError(`Expected ${type.name} to be a an object type`);
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

    if (!(type instanceof GraphQLObjectType)) {
      throw new TypeError(`Expected ${type.name} to be a an object type`);
    }

    includesFromSelectionSet(type, info, nestedIncludes, nestedMappings, selection.selectionSet);

    if (Object.keys(nestedIncludes).length > 0) {
      (query as { include?: unknown }).include = nestedIncludes;
    }
  }

  includes[relationName] = Object.keys(query as {}).length > 0 ? query : true;
}

export function includesFromFragment(
  type: GraphQLObjectType,
  info: GraphQLResolveInfo,
  includes: Record<string, unknown>,
  mappings: LoaderMappings,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  indirectMap?: IndirectLoadMap,
) {
  // Includes currently don't make sense for Interfaces and Unions
  // so we only need to handle fragments for the parent type
  if (fragment.typeCondition && fragment.typeCondition.name.value !== type.name) {
    return;
  }

  includesFromSelectionSet(type, info, includes, mappings, fragment.selectionSet, indirectMap);
}

export function includesFromSelectionSet(
  type: GraphQLObjectType,
  info: GraphQLResolveInfo,
  includes: Record<string, unknown>,
  mappings: LoaderMappings,
  selectionSet: SelectionSetNode,
  prevIndirectMap?: IndirectLoadMap,
) {
  const fields = type.getFields();
  const indirectInclude = type.extensions?.giraphQLPrismaIndirectInclude as string[] | undefined;
  const indirectMap =
    prevIndirectMap ?? (indirectInclude ? { subFields: indirectInclude, path: [] } : undefined);

  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case 'Field':
        handleField(info, fields, selection, includes, mappings, indirectMap);
        break;
      case 'FragmentSpread':
        if (!info.fragments[selection.name.value]) {
          throw new Error(`Missing fragment ${selection.name.value}`);
        }
        includesFromFragment(
          type,
          info,
          includes,
          mappings,
          info.fragments[selection.name.value],
          indirectMap,
        );
        break;
      case 'InlineFragment':
        includesFromFragment(type, info, includes, mappings, selection, indirectMap);
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

    if (!(type instanceof GraphQLObjectType)) {
      throw new TypeError('Expected returnType to be an object type');
    }

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
