// Native inheritance: a base interface and variant objects selecting relations.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import PrismaNextPlugin from 'plugin-under-test';
import type { Contract } from '../inheritance/contract';

export const builder = new SchemaBuilder<{ PrismaContract: Contract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prisma: { client: null as never },
});

export const Task = builder.prismaInterface('Task', {
  select: { owner: true },
  fields: (t) => ({ ownerEmail: t.string({ resolve: (task) => task.owner.email }) }),
});

export const Bug = builder.prismaObject('Bug', {
  interfaces: [Task],
  select: { owner: true, notes: true },
  fields: (t) => ({ severity: t.exposeString('severity') }),
});

export const Feature = builder.prismaNode('Feature', {
  interfaces: [Task],
  id: { field: 'id' },
  select: { notes: true },
  fields: (t) => ({ priority: t.exposeInt('priority') }),
});
