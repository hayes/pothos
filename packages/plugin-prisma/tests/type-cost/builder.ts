// The builder and model key of `union-key.ts`, without its fields.
import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '../../src';
import type { PrismaTypes } from './wide-types';

const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [PrismaPlugin],
  prisma: { client: null as never, dmmf: { datamodel: { models: {} } } },
});

declare const anyObject: Parameters<typeof builder.prismaObjectField>[0];
declare const anyInterface: Parameters<typeof builder.prismaInterfaceField>[0];

export const AnyModel = [anyObject, anyInterface];
