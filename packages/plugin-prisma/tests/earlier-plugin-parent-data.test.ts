import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import { execute } from '@pothos/test-utils';
import type { GraphQLFieldResolver } from 'graphql';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

type PrismaTypes = PrismaTypesFromClient<typeof prisma>;
type Recorder = (parent: never) => void;

// Stands in for scope-auth, which can't be a dev dependency here (scope-auth depends on this
// package): it calls the field's and the parent type's `recordParent` with the parent its
// wrapper receives, as scope-auth calls `authScopes`.
const pluginName = 'recordParentTest' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;

class RecordParentPlugin extends BasePlugin<SchemaTypes> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, object, object>,
    fieldConfig: PothosOutputFieldConfig<SchemaTypes>,
  ): GraphQLFieldResolver<unknown, object, object> {
    const typeRecorder = this.buildCache.getTypeConfig(fieldConfig.parentType).extensions
      ?.recordParent as Recorder | undefined;
    const fieldRecorder = fieldConfig.extensions?.recordParent as Recorder | undefined;

    if (!typeRecorder && !fieldRecorder) {
      return resolver;
    }

    return (parent, args, context, info) => {
      typeRecorder?.(parent as never);
      fieldRecorder?.(parent as never);

      return resolver(parent, args, context, info);
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, RecordParentPlugin as never);

// The recording plugin is listed first, so its wrapper runs outside the prisma plugin's.
const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes; Context: {} }>({
  plugins: [pluginName, PrismaPlugin],
  prisma: { client: prisma, dmmf: getDatamodel() },
});

interface Row {
  email?: string;
  profile?: { bio: string | null } | null;
}

const seen: { type: unknown[]; field: unknown[]; typeInclude: unknown[]; impl: unknown[] } = {
  type: [],
  field: [],
  typeInclude: [],
  impl: [],
};

const recordProfile = (into: unknown[]) => (user: Row) => {
  into.push(user.profile === undefined ? 'missing' : user.profile?.bio);
};

const User = builder.prismaObject('User', {
  select: { id: true, email: true },
  extensions: { recordParent: (user: Row) => seen.type.push(user.email) },
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.string({
      nullable: true,
      select: { profile: { select: { bio: true } } },
      extensions: { recordParent: recordProfile(seen.field) },
      resolve: (user) => user.profile?.bio ?? null,
    }),
    bioFromFunction: t.string({
      nullable: true,
      select: () => ({ profile: { select: { bio: true } } }),
      extensions: { recordParent: recordProfile(seen.field) },
      resolve: (user) => user.profile?.bio ?? null,
    }),
  }),
});

const UserWithProfile = builder.prismaObject('User', {
  variant: 'UserWithProfile',
  include: { profile: true },
  extensions: { recordParent: recordProfile(seen.typeInclude) },
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
  }),
});

const IfaceUser = builder.prismaInterface('User', {
  variant: 'IfaceUser',
  select: { id: true },
  resolveType: () => 'ImplUser',
  fields: (t) => ({
    ifaceId: t.exposeID('id'),
  }),
});

// The implementing type's type-level checks also run on the field the interface declares.
const ImplUser = builder.prismaObject('User', {
  variant: 'ImplUser',
  interfaces: [IfaceUser],
  select: { id: true, profile: { select: { bio: true } } },
  extensions: { recordParent: recordProfile(seen.impl) },
  fields: () => ({}),
});

builder.queryType({
  fields: (t) => ({
    planned: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    plain: t.field({
      type: User,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }),
    }),
    partial: t.field({
      type: User,
      resolve: () => ({ id: 1 }) as never,
    }),
    implPlanned: t.prismaField({
      type: ImplUser,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    implPlain: t.field({
      type: ImplUser,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }) as never,
    }),
    ifacePlanned: t.prismaField({
      type: IfaceUser,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    plannedWithProfile: t.prismaField({
      type: UserWithProfile,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    plainWithProfile: t.field({
      type: UserWithProfile,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }) as never,
    }),
  }),
});

const schema = builder.toSchema();

describe('plugins listed before prisma see the parent data its types promise', () => {
  let user: { email: string; profile: { bio: string | null } | null };

  beforeAll(async () => {
    user = await prisma.user.findUniqueOrThrow({ where: { id: 1 }, include: { profile: true } });
  });

  beforeEach(() => {
    queries.length = 0;
    seen.type.length = 0;
    seen.field.length = 0;
    seen.typeInclude.length = 0;
    seen.impl.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("a planned row has the field's select without a reload", async () => {
    const result = await execute({
      schema,
      document: gql`{ planned { id bio } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.field).toEqual([user.profile?.bio]);
    // The type's recorder runs for each field.
    expect(seen.type).toEqual([user.email, user.email]);
    expect(queries).toHaveLength(1);
  });

  it("a row the plugin didn't load is reloaded with the field's select before earlier plugins run", async () => {
    const result = await execute({
      schema,
      document: gql`{ plain { id bio } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plain: { id: '1', bio: user.profile?.bio ?? null } });
    expect(seen.field).toEqual([user.profile?.bio]);
    // The root query and one batched reload, as before.
    expect(queries).toHaveLength(2);
  });

  it('a function select is loaded before earlier plugins run, planned or not', async () => {
    const planned = await execute({
      schema,
      document: gql`{ planned { bioFromFunction } }`,
      contextValue: {},
    });

    expect(planned.errors).toBeUndefined();
    expect(seen.field).toEqual([user.profile?.bio]);
    expect(queries).toHaveLength(1);

    const plain = await execute({
      schema,
      document: gql`{ plain { bioFromFunction } }`,
      contextValue: {},
    });

    expect(plain.errors).toBeUndefined();
    expect(seen.field).toEqual([user.profile?.bio, user.profile?.bio]);
    expect(queries).toHaveLength(3);
  });

  it("a row without the type's select columns is reloaded before earlier plugins run", async () => {
    const result = await execute({
      schema,
      document: gql`{ partial { id } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.type).toEqual([user.email]);
    expect(queries).toHaveLength(1);
  });

  it("a planned row has the type's include without a reload", async () => {
    const result = await execute({
      schema,
      document: gql`{ plannedWithProfile { id email } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.typeInclude).toEqual([user.profile?.bio, user.profile?.bio]);
    expect(queries).toHaveLength(1);
  });

  it("a row without the type's include is reloaded once before earlier plugins run", async () => {
    const result = await execute({
      schema,
      document: gql`{ plainWithProfile { id email } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plainWithProfile: { id: '1', email: user.email } });
    expect(seen.typeInclude).toEqual([user.profile?.bio, user.profile?.bio]);
    // The root query and one reload shared by both fields.
    expect(queries).toHaveLength(2);
  });

  it("an inherited field's row the plugin didn't load gets the implementing type's select", async () => {
    const plain = await execute({
      schema,
      document: gql`{ implPlain { ifaceId } }`,
      contextValue: {},
    });

    expect(plain.errors).toBeUndefined();
    expect(seen.impl).toEqual([user.profile?.bio]);
    expect(queries).toHaveLength(2);

    seen.impl.length = 0;
    queries.length = 0;

    const planned = await execute({
      schema,
      document: gql`{ implPlanned { ifaceId } }`,
      contextValue: {},
    });

    expect(planned.errors).toBeUndefined();
    expect(seen.impl).toEqual([user.profile?.bio]);
    expect(queries).toHaveLength(1);
  });

  it('a row planned through the interface is not reloaded for the implementing type', async () => {
    const result = await execute({
      schema,
      document: gql`{ ifacePlanned { ifaceId } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    // The plan only walked the interface, so its row lacks the implementing type's select.
    expect(seen.impl).toEqual(['missing']);
    expect(queries).toHaveLength(1);
  });
});
