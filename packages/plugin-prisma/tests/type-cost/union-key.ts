// While completing a model name, the editor checks the call with every model key at once. Adding
// fields by model key then costs one check per model, not one per pair of models.
import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '../../src';
import type { PrismaTypes } from './wide-types';

const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [PrismaPlugin],
  prisma: { client: null as never, dmmf: { datamodel: { models: {} } } },
});

declare const anyObject: Parameters<typeof builder.prismaObjectField>[0];
declare const anyInterface: Parameters<typeof builder.prismaInterfaceField>[0];

builder.prismaObjectField(anyObject, 'label', (t) => t.string({ resolve: (row) => String(row) }));

builder.prismaObjectFields(anyObject, (t) => ({
  label: t.string({ resolve: (row) => String(row) }),
}));

builder.prismaInterfaceField(anyInterface, 'label', (t) =>
  t.string({ resolve: (row) => String(row) }),
);

builder.prismaInterfaceFields(anyInterface, (t) => ({
  label: t.string({ resolve: (row) => String(row) }),
}));
