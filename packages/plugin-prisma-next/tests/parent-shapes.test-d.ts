import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { Collection } from '@prisma/orm-family-sql/orm-client';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { type RelationRefinementCollection } from '../src';
import type { Contract } from './fixtures/sample-contract';
import type { Contract as PostgresContract } from './postgres/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});

const adminRef = builder.prismaObject('User', {
  variant: 'AdminUser',
  fields: (t) => ({ id: t.exposeID('id') }),
});

const iface = builder.prismaInterface('Post', {
  fields: (t) => ({ id: t.exposeID('id') }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    // The parent only holds what `select` forces, so reading another column is an error.
    variantWithSelect: t.variant(adminRef, {
      select: ['email'],
      isNull: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        // @ts-expect-error firstName isn't selected, so it may be missing at runtime
        return user.firstName === '';
      },
    }),
    variantWithoutSelect: t.variant(adminRef, {
      // @ts-expect-error nothing was selected, so no column is known to be loaded
      isNull: (user) => user.email === '',
    }),
    // Relation fields load only the relation, so other columns are optional in their callbacks.
    connection: t.relatedConnection('posts', {
      cursor: 'id',
      totalCount: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string | undefined>();
        return 0;
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    // A planned root field may return an interface.
    posts: t.prismaField({
      type: [iface],
      resolve: () => null as never,
    }),
    post: t.prismaField({
      type: iface,
      nullable: true,
      resolve: () => null,
    }),
    postConnection: t.prismaConnection({
      type: iface,
      cursor: 'id',
      resolve: () => null as never,
    }),
    // A nullable connection can resolve to null, and a non-null one can't.
    nullableConnection: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      nullable: true,
      resolve: () => null,
    }),
    requiredConnection: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      nullable: false,
      // @ts-expect-error the field isn't nullable
      resolve: () => null,
    }),
  }),
});

const postgresBuilder = new SchemaBuilder<{ PrismaNextContract: PostgresContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});
postgresBuilder.queryType({
  fields: (t) => ({
    // Bytes columns have no ordering operators.
    bytes: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error a bytes column can't order a cursor
      cursor: ['payload', 'id'],
      resolve: () => null as never,
    }),
  }),
});

// Upstream strips these from an include callback. Drift in either list fails here: the upstream
// callback's parameter is read from `Collection#include` rather than restated. Its cardinality is
// an unresolved generic there, which reads as the to-one surface, so that's what is compared.
type IncludeOverload<F> = F extends {
  (...args: never[]): unknown;
  (this: never, name: never, refine: (collection: infer Refine) => never): unknown;
}
  ? Refine
  : never;
type UpstreamKeys = keyof IncludeOverload<Collection<Contract, 'Post'>['include']> & string;
type PluginKeys = keyof RelationRefinementCollection<Types, 'Post', 'author'> & string;
expectTypeOf<Exclude<PluginKeys, UpstreamKeys>>().toEqualTypeOf<never>();
expectTypeOf<Exclude<UpstreamKeys, PluginKeys>>().toEqualTypeOf<never>();
expectTypeOf<UpstreamKeys>().not.toEqualTypeOf<never>();
