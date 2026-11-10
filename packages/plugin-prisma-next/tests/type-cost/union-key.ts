// While completing a model name, the editor checks the call with every model key at once. A field
// with a `select` then costs one check per model, not one per pair of models.
import SchemaBuilder from '@pothos/core';
import PrismaNextPlugin from '../../src';
import type { Contract } from '../fixtures/wide-contract';

const builder = new SchemaBuilder<{ PrismaContract: Contract }>({
  plugins: [PrismaNextPlugin],
  prisma: { client: null as never },
});

declare const anyModel: Parameters<typeof builder.prismaObject>[0];

export const AnyObject = builder.prismaObject(anyModel, {
  fields: (t) => ({
    text: t.string({ select: ['title', 'body'], resolve: (row) => row.title + row.body }),
  }),
});

export const AnyInterface = builder.prismaInterface(anyModel, {
  fields: (t) => ({
    title: t.string({ select: ['title'], resolve: (row) => row.title }),
  }),
});

builder.prismaObjectField(anyModel, 'body', (t) =>
  t.string({ select: ['body'], resolve: (row) => row.body }),
);

builder.prismaObjectFields(anyModel, (t) => ({
  label: t.string({ select: ['id', 'title'], resolve: (row) => row.id + row.title }),
}));
