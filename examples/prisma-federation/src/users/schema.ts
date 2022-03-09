import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';
import PrismaPlugin from '@pothos/plugin-prisma';
// import RelayPlugin from '@pothos/plugin-relay';
import type PrismaTypes from '../../prisma/generated';
import { db } from '../db';

export const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [
    DirectivesPlugin,
    PrismaPlugin,
    FederationPlugin,
    //   RelayPlugin
  ],
  prisma: {
    client: db,
  },
  // useGraphQLToolsUnorderedDirectives: true,
  // relayOptions: {
  //   clientMutationId: 'omit',
  //   cursorType: 'String',
  // },
});

const User = builder.prismaObject('User', {
  findUnique: ({ id }) => ({ id: Number.parseInt(String(id), 10) }),
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
  key: builder.selection<{ id: number | string }>('id'),
  resolveReference: ({ id }) =>
    db.user.findFirst({ where: { id: Number.parseInt(String(id), 10) } }),
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
          where: { id: Number.parseInt(String(args.id), 10) },
        }),
    }),
  }),
});

export const schema = builder.toSubGraphSchema({});
