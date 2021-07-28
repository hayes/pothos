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

export type IncludeMap = Record<string, unknown>;
export type LoaderMappings = Record<
  string,
  {
    field: string;
    alias?: string;
    mappings: LoaderMappings;
  }
>;

function handleField(
  info: GraphQLResolveInfo,
  fields: GraphQLFieldMap<unknown, unknown>,
  selection: FieldNode,
  includes: IncludeMap,
  mappings: LoaderMappings,
) {
  const field = fields[selection.name.value];

  if (!field) {
    throw new Error(`Unknown field ${selection.name.value}`);
  }

  const relationName = field.extensions?.giraphQLPrismaRelation as string | undefined;

  if (!relationName || includes[relationName]) {
    return;
  }

  let query = field.extensions?.giraphQLPrismaQuery as unknown;
  if (!query) {
    return;
  }

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
) {
  // Includes currently don't make sense for Interfaces and Unions
  // so we only need to handle fragments for the parent type
  if (fragment.typeCondition && fragment.typeCondition.name.value !== type.name) {
    return;
  }

  includesFromSelectionSet(type, info, includes, mappings, fragment.selectionSet);
}

export function includesFromSelectionSet(
  type: GraphQLObjectType,
  info: GraphQLResolveInfo,
  includes: Record<string, unknown>,
  mappings: LoaderMappings,
  selectionSet: SelectionSetNode,
) {
  const fields = type.getFields();

  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case 'Field':
        handleField(info, fields, selection, includes, mappings);
        break;
      case 'FragmentSpread':
        if (!info.fragments[selection.name.value]) {
          throw new Error(`Missing fragment ${selection.name.value}`);
        }
        includesFromFragment(type, info, includes, mappings, info.fragments[selection.name.value]);
        break;
      case 'InlineFragment':
        includesFromFragment(type, info, includes, mappings, selection);
        break;
      default:
        throw new Error(`Unexpected selection kind ${(selection as { kind: string }).kind}`);
    }
  }
}

export function includesFromInfo(info: GraphQLResolveInfo) {
  const { fieldNodes } = info;

  const includes: IncludeMap = {};
  const mappings: LoaderMappings = {};
  for (const node of fieldNodes) {
    if (!node.selectionSet) {
      continue;
    }

    const type = getNamedType(info.returnType);

    if (!(type instanceof GraphQLObjectType)) {
      throw new TypeError('Expected returnType to be an object type');
    }

    includesFromSelectionSet(type, info, includes, mappings, node.selectionSet);
  }

  if (Object.keys(includes).length > 0) {
    return { includes, mappings };
  }

  return {};
}
