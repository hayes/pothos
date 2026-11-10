// A builder without `PrismaTypes` names the missing setup where a model name is given.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf, it } from 'vitest';
import PrismaPlugin, { prismaConnectionHelpers } from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

type MissingPrismaTypes = string & {
  readonly missingPrismaTypes: 'Set PrismaTypes on SchemaTypes: new SchemaBuilder<{ PrismaTypes: PrismaTypes }>(...)';
};

const builder = new SchemaBuilder<{ Context: { userId: number } }>({
  plugins: [RelayPlugin, PrismaPlugin],
  relay: {},
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

it('takes the setup hint instead of a model name', () => {
  expectTypeOf<Parameters<typeof builder.prismaObject>[0]>().toEqualTypeOf<MissingPrismaTypes>();
  expectTypeOf<Parameters<typeof builder.prismaNode>[0]>().toEqualTypeOf<MissingPrismaTypes>();
});

it('reports the missing setup at the model name', () => {
  builder.prismaObject(
    // @ts-expect-error PrismaTypes is not set
    'User',
    { fields: () => ({}) },
  );
  builder.prismaInterface(
    // @ts-expect-error PrismaTypes is not set
    'User',
    { fields: () => ({}) },
  );
  builder.prismaNode(
    // @ts-expect-error PrismaTypes is not set
    'User',
    { id: { resolve: () => '' }, fields: () => ({}) },
  );
  builder.prismaObjectField(
    // @ts-expect-error PrismaTypes is not set
    'User',
    'name',
    (t) => t.string({ resolve: () => '' }),
  );
  builder.prismaInterfaceFields(
    // @ts-expect-error PrismaTypes is not set
    'User',
    () => ({}),
  );
  prismaConnectionHelpers(
    builder,
    // @ts-expect-error PrismaTypes is not set
    'User',
    {},
  );
  builder.queryFields((t) => ({
    user: t.prismaField({
      // @ts-expect-error PrismaTypes is not set
      type: 'User',
      resolve: () => {
        throw new Error('not called');
      },
    }),
  }));
});

it('builds a schema that uses no prisma types', () => {
  builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
  builder.toSchema();
});
