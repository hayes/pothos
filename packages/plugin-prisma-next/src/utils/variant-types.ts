import { PothosSchemaError } from '@pothos/core';
import type { GraphQLInterfaceType, GraphQLSchema } from 'graphql';
import { PRISMA_NEXT_MODEL } from '../constants.js';
import type { AnyContract } from '../types.js';
import { modelDiscriminator, relatedModelKey } from './contract.js';

const cache = new WeakMap<GraphQLInterfaceType, Map<string, string>>();

/**
 * The GraphQL type each discriminator value of a hierarchy interface resolves to: the one
 * implementation registered for that variant's model, whatever it is named. Throws when a variant
 * has no implementation or several, which the default `resolveType` can't route.
 */
export function variantTypeNames(
  contract: AnyContract,
  schema: GraphQLSchema,
  iface: GraphQLInterfaceType,
): Map<string, string> {
  let names = cache.get(iface);
  if (names) {
    return names;
  }
  const model = iface.extensions?.[PRISMA_NEXT_MODEL] as string;
  const implementations = schema.getPossibleTypes(iface);
  names = new Map();
  for (const [value, variant] of Object.entries(
    modelDiscriminator(contract, model)?.variants ?? {},
  )) {
    const variantModel = relatedModelKey(contract, variant);
    const types = implementations.filter(
      (type) => type.extensions?.[PRISMA_NEXT_MODEL] === variantModel,
    );
    if (types.length !== 1) {
      throw new PothosSchemaError(
        `prismaInterface '${iface.name}' routes rows by discriminator, but variant model '${variantModel}' ('${value}') has ` +
          (types.length === 0
            ? 'no implementing type. Register one that implements the interface'
            : `several implementing types (${types.map((type) => type.name).join(', ')}). Keep one`) +
          ', or give the interface its own resolveType.',
      );
    }
    names.set(value, types[0].name);
  }
  cache.set(iface, names);
  return names;
}
