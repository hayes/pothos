import { GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLType } from 'graphql';

export function replaceType<T extends GraphQLType>(
  type: T,
  newTypes: Map<string, GraphQLNamedType>,
  referencedBy: string,
  subGraph: string,
): T {
  if (type instanceof GraphQLNonNull) {
    return new GraphQLNonNull(replaceType(type.ofType, newTypes, referencedBy, subGraph)) as T;
  }

  if (type instanceof GraphQLList) {
    return new GraphQLList(replaceType(type.ofType, newTypes, referencedBy, subGraph)) as T;
  }

  const newType = newTypes.get((type as GraphQLNamedType).name);

  if (!newType) {
    throw new Error(
      `${
        (type as GraphQLNamedType).name
      } (referenced by ${referencedBy}) does not exist in subGraph ${subGraph}`,
    );
  }

  return newType as T;
}
