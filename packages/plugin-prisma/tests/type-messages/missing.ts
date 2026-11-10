// Model names given to a builder whose `PrismaTypes` has no models. Each line marked `says:` must
// fail with a message containing that text.
import SchemaBuilder, { type SchemaTypes } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import PrismaPlugin, { type PrismaTypesFromClient, prismaConnectionHelpers } from '../../src';
import { prisma } from '../example/builder';
import { getDatamodel } from '../generated.js';

// `prismaFieldWithInput` exists only with plugin-with-input, which this package doesn't depend on.
declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      withInput: unknown;
    }
  }
}

const builder = new SchemaBuilder<{ Context: { userId: number } }>({
  plugins: [RelayPlugin, PrismaPlugin],
  relay: {},
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

builder.prismaObject('User', { fields: () => ({}) }); // says: Set PrismaTypes to the generated types
builder.prismaInterface('User', { fields: () => ({}) }); // says: Set PrismaTypes to the generated types
builder.prismaNode('User', { id: { resolve: () => '' }, fields: () => ({}) }); // says: Set PrismaTypes to the generated types
builder.prismaObjectField('User', 'a', (t) => t.string({ resolve: () => '' })); // says: Set PrismaTypes to the generated types
builder.prismaObjectFields('User', () => ({})); // says: Set PrismaTypes to the generated types
builder.prismaInterfaceField('User', 'a', (t) => t.string({ resolve: () => '' })); // says: Set PrismaTypes to the generated types
builder.prismaInterfaceFields('User', () => ({})); // says: Set PrismaTypes to the generated types
prismaConnectionHelpers(builder, 'User', { cursor: 'id' }); // says: Set PrismaTypes to the generated types

builder.queryFields((t) => ({
  one: t.prismaField({
    type: 'User', // says: Set PrismaTypes to the generated types
    resolve: () => {
      throw new Error('not called');
    },
  }),
  // The list form reports the tuple element against the ref, without the hint.
  list: t.prismaField({
    type: ['User'], // says: Type 'string' is not assignable to type 'PrismaRef<any, PrismaModelTypes>'
    resolve: () => [],
  }),
  connection: t.prismaConnection({
    type: 'User', // says: Set PrismaTypes to the generated types
    cursor: 'id', // says: Type 'string' is not assignable to type 'never'
    resolve: () => [],
  }),
  withInput: t.prismaFieldWithInput({
    type: 'User', // says: Set PrismaTypes to the generated types
    input: {},
    resolve: () => {
      throw new Error('not called');
    },
  }),
  withInputList: t.prismaFieldWithInput({
    type: ['User'], // says: Type 'string' is not assignable to type 'PrismaRef<any, PrismaModelTypes>'
    input: {},
    resolve: () => [],
  }),
}));

// `PrismaTypes` set, but to a type without models.
const empty = new SchemaBuilder<{ PrismaTypes: {} }>({
  plugins: [RelayPlugin, PrismaPlugin],
  relay: {},
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

empty.prismaObject('User', { fields: () => ({}) }); // says: Set PrismaTypes to the generated types
empty.prismaObjectFields('User', () => ({})); // says: Set PrismaTypes to the generated types

const fromClient = new SchemaBuilder<{ PrismaTypes: PrismaTypesFromClient<{}> }>({
  plugins: [RelayPlugin, PrismaPlugin],
  relay: {},
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

fromClient.prismaObject('User', { fields: () => ({}) }); // says: Set PrismaTypes to the generated types
// TypeScript 7 lists the ref first in this union, and the type is long enough to be shortened.
fromClient.prismaInterfaceFields('User', () => ({})); // says: | NoModelsInPrismaTypes<...>'
