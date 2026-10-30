import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { type CollectionFor, type ModelName } from '../src';
import type { Contract } from './inheritance/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

expectTypeOf<ModelName<Types>>().toEqualTypeOf<'Bug' | 'Feature' | 'Task' | 'User'>();

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});
const orm = null as unknown as { Task: CollectionFor<Types, 'Task'> };
const task = builder.prismaInterface('Task', {
  fields: (t) => ({
    id: t.exposeID('id'),
    // @ts-expect-error A base type doesn't have its variants' columns.
    severity: t.exposeString('severity'),
    // @ts-expect-error Unknown relations are rejected.
    nope: t.relation('nope'),
  }),
});

builder.prismaObject('Bug', {
  interfaces: [task],
  fields: (t) => ({
    // Inherited columns and relations are available without annotation.
    title: t.exposeString('title'),
    severity: t.exposeString('severity'),
    owner: t.relation('owner'),
    upper: t.string({
      resolve: (row) => {
        expectTypeOf(row).not.toBeAny();
        return 'x';
      },
    }),
    // @ts-expect-error A sibling variant's column.
    priority: t.exposeInt('priority'),
    extra: t.relation('owner', {
      // @ts-expect-error Unknown options are rejected.
      nope: true,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    bugs: t.prismaField({ type: ['Bug'], resolve: () => orm.Task.variant('bug') }),
    // @ts-expect-error The base collection would load every variant.
    all: t.prismaField({ type: ['Bug'], resolve: () => orm.Task }),
    // @ts-expect-error Another variant's rows.
    wrong: t.prismaField({ type: ['Bug'], resolve: () => orm.Task.variant('feature') }),
    tasks: t.prismaField({ type: ['Task'], resolve: () => orm.Task }),
    // @ts-expect-error `resolve` is required.
    noResolve: t.prismaField({ type: ['Bug'] }),
  }),
});
