// The builder and model key of `union-key.ts`, without its fields.
import SchemaBuilder from '@pothos/core';
import PrismaNextPlugin from '../../src';
import type { Contract } from '../fixtures/wide-contract';

const builder = new SchemaBuilder<{ PrismaContract: Contract }>({
  plugins: [PrismaNextPlugin],
  prisma: { client: null as never },
});

declare const anyModel: Parameters<typeof builder.prismaObject>[0];

export const AnyModel = anyModel;
