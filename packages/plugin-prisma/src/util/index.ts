import { GraphQLNamedType, GraphQLResolveInfo } from 'graphql';

export * from './map-includes';
export * from './merge-includes';

export function resolveIndirectType(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
): GraphQLNamedType {
  const indirectInclude = type.extensions?.giraphQLPrismaIndirectInclude as
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

  return type;
}
