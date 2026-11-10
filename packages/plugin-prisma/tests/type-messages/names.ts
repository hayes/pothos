// Mistyped names. Each line marked `lists:` must fail with a message naming the valid names.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import PrismaPlugin, { type PrismaTypesFromClient, prismaConnectionHelpers } from '../../src';
import { prisma } from '../example/builder';
import { getDatamodel } from '../generated.js';

type PrismaTypes = PrismaTypesFromClient<typeof prisma>;

const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [RelayPlugin, PrismaPlugin],
  relay: {},
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

builder.prismaObject('User', {
  fields: (t) => ({
    name: t.exposeString('nme'), // lists: "email" "name"
    names: t.expose('nme', { type: 'String' }), // lists: "email" "name"
    posts: t.relation('psts'), // lists: "posts" "comments" "profile"
    postPages: t.relatedConnection('posts', {
      cursor: 'nme', // lists: "id" "bigIntId" "createdAt"
    }),
  }),
});

builder.prismaNode('Post', {
  id: {
    field: 'nme', // lists: "id" "bigIntId" "createdAt"
  },
  fields: () => ({}),
});

builder.queryFields((t) => ({
  users: t.prismaConnection({
    type: 'User',
    cursor: 'nme', // lists: "id" "email"
    resolve: (query) => prisma.user.findMany(query),
  }),
}));

prismaConnectionHelpers(builder, 'Post', {
  cursor: 'nme', // lists: "id" "bigIntId" "createdAt"
});

builder.prismaObjectFields('Usr', () => ({})); // lists: "User" "Post"
