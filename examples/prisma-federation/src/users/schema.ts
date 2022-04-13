import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';
import PrismaPlugin from '@pothos/plugin-prisma';
import type PrismaTypes from '../../prisma/generated';
import { db } from '../db';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    ID: { Input: string; Output: string | number };
  };
}>({
  plugins: [DirectivesPlugin, PrismaPlugin, FederationPlugin],
  prisma: {
    client: db,
  },
});

const User = builder.prismaObject('User', {
  findUnique: ({ id }) => ({ id }),
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
  }),
});

export const schema = builder.toSubGraphSchema({});
