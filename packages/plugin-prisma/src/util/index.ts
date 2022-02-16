import { GraphQLNamedType, GraphQLResolveInfo, isAbstractType } from 'graphql';

export * from './map-includes';
export * from './merge-includes';

export function resolveIndirectType(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  typename?: string,
): GraphQLNamedType {
  const indirectInclude = type.extensions?.pothosPrismaIndirectInclude as
    | { getType: () => string }
    | undefined;

  if (indirectInclude) {
    const includeTypeName = indirectInclude.getType();
    const resolvedType = info.schema.getType(includeTypeName);

    if (!resolvedType) {
      throw new Error(`Could not find type ${includeTypeName}`);
    }

    return resolveIndirectType(resolvedType, info);
  }

  if (isAbstractType(type) && typename) {
    const namedType = info.schema.getType(typename);

    if (namedType) {
      return namedType;
    }
  }

  return type;
}
