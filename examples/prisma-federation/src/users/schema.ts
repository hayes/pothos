import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';
import PrismaPlugin from '@pothos/plugin-prisma';
import RelayPlugin from '@pothos/plugin-relay';
import type PrismaTypes from '../../prisma/generated';
import { db } from '../db';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    ID: { Input: string; Output: number | string };
  };
}>({
  plugins: [DirectivesPlugin, PrismaPlugin, FederationPlugin, RelayPlugin],
  prisma: {
    client: db,
  },
  relay: {
    clientMutationId: 'omit',
    cursorType: 'String',
    pageInfoTypeOptions: {
      shareable: true,
    },
  },
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
  }),
});

builder.asEntity(User, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => db.user.findFirst({ where: { id: Number.parseInt(id, 10) } }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: 'User',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (query, root, args) =>
        db.user.findUnique({
          ...query,
          where: { id: Number.parseInt(args.id, 10) },
        }),
    }),
    users: t.prismaConnection({
      type: 'User',
      nullable: true,
      cursor: 'id',
      resolve: (query, root, args) =>
        db.user.findMany({
          ...query,
        }),
    }),
  }),
});

export const schema = builder.toSubGraphSchema({});
