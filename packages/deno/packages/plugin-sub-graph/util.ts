// @ts-nocheck
import { PothosSchemaError } from '../core/index.ts';
import { GraphQLList, type GraphQLNamedType, GraphQLNonNull, type GraphQLType } from 'https://cdn.skypack.dev/graphql?dts';
export function replaceType<T extends GraphQLType>(type: T, newTypes: Map<string, GraphQLNamedType>, referencedBy: string, subGraphs: string[]): T {
    if (type instanceof GraphQLNonNull) {
        return new GraphQLNonNull(replaceType(type.ofType as GraphQLType, newTypes, referencedBy, subGraphs)) as T;
    }
    if (type instanceof GraphQLList) {
        return new GraphQLList(replaceType(type.ofType, newTypes, referencedBy, subGraphs)) as T;
    }
    const newType = newTypes.get((type as GraphQLNamedType).name);
    if (!newType) {
        throw new PothosSchemaError(`${(type as GraphQLNamedType).name} (referenced by ${referencedBy}) does not exist in subGraph (${subGraphs})`);
    }
    return newType as T;
}
