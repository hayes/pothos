import SchemaBuilder from '@pothos/core';
import DataloaderPlugin from '@pothos/plugin-dataloader';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtilsPlugin from '@pothos/plugin-prisma-utils';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';
import ValidationPlugin from '@pothos/plugin-validation';
import type PrismaTypes from '../prisma/generated';
import { db } from './db';

export const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [
    ScopeAuthPlugin,
    PrismaPlugin,
    PrismaUtilsPlugin,
    RelayPlugin,
    DataloaderPlugin,
    SimpleObjectsPlugin,
    ValidationPlugin,
  ],
  authScopes: () => ({}),
  relayOptions: {},
  prisma: {
    client: db,
  },
});

builder.queryType({});
