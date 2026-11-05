// A contract with several namespaces names its models `namespace.Model`.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import prismaNextPlugin, { prismaConnectionHelpers } from 'plugin-under-test';
import type { Contract } from '../namespaces/contract';

export const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});

export const OrgUser = builder.prismaInterface('nsa.User', {
  select: { org: true, posts: true },
  fields: (t) => ({ orgId: t.exposeInt('orgId') }),
});

export const Post = builder.prismaNode('nsa.Post', {
  id: { field: 'id' },
  select: { user: true },
  fields: (t) => ({ title: t.exposeString('title') }),
});

export const userPages = prismaConnectionHelpers(builder, 'nsa.User', {
  resolveNode: (user) => ({ user }),
});
