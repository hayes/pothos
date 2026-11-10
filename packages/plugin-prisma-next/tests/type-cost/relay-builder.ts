// The builder, collections and connection helpers that `connections.ts` and `loads.ts` use.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import PrismaNextPlugin, {
  type CollectionFor,
  type ModelKey,
  prismaConnectionHelpers,
} from '../../src';
import type { Contract } from '../fixtures/wide-contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaContract: Contract }>;

export declare const orm: { [M in ModelKey<Types>]: CollectionFor<Types, M> };

export const builder = new SchemaBuilder<{ PrismaContract: Contract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prisma: { client: null as never },
});

export const helpers = [
  prismaConnectionHelpers(builder, 'Model0', {}),
  prismaConnectionHelpers(builder, 'Model1', {}),
  prismaConnectionHelpers(builder, 'Model2', {}),
  prismaConnectionHelpers(builder, 'Model3', {}),
  prismaConnectionHelpers(builder, 'Model4', {}),
  prismaConnectionHelpers(builder, 'Model5', {}),
  prismaConnectionHelpers(builder, 'Model6', {}),
  prismaConnectionHelpers(builder, 'Model7', {}),
] as const;
