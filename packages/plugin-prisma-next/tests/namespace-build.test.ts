import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import postgres from '@prisma/orm-postgres/runtime';
import { getNamedType } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin, { type AnyContract, prismaConnectionHelpers } from '../src';
import { collectionForModel, resolveContractModel } from '../src/utils/contract';
import { getModelIdentities } from '../src/utils/model';
import { loadPostgresContract, postgresUrl as url } from './fixtures/helpers';
import type { Contract as InheritanceContract } from './inheritance-namespaces/contract';
import type { Contract } from './namespaces/contract';

// Namespaced contracts, checked without a database: schemas here are only built.
const contract = loadPostgresContract<Contract>(
  new URL('./namespaces/contract.json', import.meta.url),
);
const client = postgres({ contract, url, verifyMarker: false });
const { nsb } = client.orm;
const inheritanceContract = loadPostgresContract<InheritanceContract>(
  new URL('./inheritance-namespaces/contract.json', import.meta.url),
);

function createBuilder() {
  return new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client },
  });
}

describe('a contract with one named namespace', () => {
  const single = {
    domain: {
      namespaces: {
        public: {
          models: { Account: { fields: {}, relations: {}, storage: {} }, public: {} },
        },
      },
    },
  } as unknown as AnyContract;

  it('finds a bare key in a client namespaced as orm.public.Account', () => {
    const account = {};
    expect(collectionForModel(single, { public: { Account: account } }, 'Account')).toBe(account);
  });

  it('finds a bare key in a flat client', () => {
    const account = {};
    expect(collectionForModel(single, { Account: account }, 'Account')).toBe(account);
  });

  it('does not mistake a namespace facet for a model of the same name', () => {
    const model = {};
    expect(collectionForModel(single, { public: { public: model } }, 'public')).toBe(model);
  });

  it('finds no collection for a bad key', () => {
    expect(collectionForModel(single, { public: {} }, 'public.Account')).toBeUndefined();
  });
});

describe('default type names', () => {
  it('names a type after the bare model', () => {
    const builder = createBuilder();
    builder.prismaObject('nsb.User', { fields: (t) => ({ id: t.exposeString('id') }) });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(builder.toSchema().getType('User')).toBeDefined();
  });

  it('reports two models that default to one type name', () => {
    const builder = createBuilder();
    builder.prismaObject('nsa.User', { fields: (t) => ({ id: t.exposeInt('id') }) });
    expect(() =>
      builder.prismaObject('nsb.User', { fields: (t) => ({ id: t.exposeString('id') }) }),
    ).toThrow(/Duplicate typename: Another type with name User already exists/);
  });

  it('lets a model key refer to its type after `name` renames it', () => {
    const builder = createBuilder();
    builder.prismaObject('nsa.User', { fields: (t) => ({ id: t.exposeInt('id') }) });
    builder.prismaObject('nsb.User', {
      name: 'NsbUser',
      fields: (t) => ({ id: t.exposeString('id') }),
    });
    builder.queryType({
      fields: (t) => ({ b: t.prismaField({ type: ['nsb.User'], resolve: () => nsb.User }) }),
    });
    const schema = builder.toSchema();
    expect(getNamedType(schema.getQueryType()!.getFields().b!.type).name).toBe('NsbUser');
  });

  it('builds when an unregistered model shares its default name with a registered type', () => {
    const builder = createBuilder();
    // `nsb.User` is not registered, though the helpers give it a default ref named `User` too.
    prismaConnectionHelpers(builder, 'nsb.User', {});
    builder.prismaObject('nsa.User', { fields: (t) => ({ id: t.exposeInt('id') }) });
    builder.prismaObject('nsa.Post', {
      fields: (t) => ({ id: t.exposeInt('id'), user: t.relation('user') }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    const schema = builder.toSchema();
    expect(schema.getType('User')).toBeDefined();
  });

  it('does not let a relation to an unregistered model resolve to a same-named type', () => {
    const builder = createBuilder();
    // `Post.user` targets `nsa.User`. The registered `User` is `nsb.User`, a different model.
    builder.prismaObject('nsb.User', { fields: (t) => ({ id: t.exposeString('id') }) });
    builder.prismaObject('nsa.Post', {
      fields: (t) => ({ user: t.relation('user') }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow(/has not been implemented/);
  });
});

describe('native inheritance across namespaces', () => {
  it("finds a variant's identities through its base's table, even with a table of its own", () => {
    const { models } = inheritanceContract.domain.namespaces.inha;
    expect(models.Feature.storage.table).toBe('feature');
    expect(resolveContractModel(inheritanceContract, 'inha.Feature')?.storage).toEqual(
      models.Task.storage,
    );
    expect(getModelIdentities(inheritanceContract, 'inha.Feature')).toEqual([['id']]);
  });
});
