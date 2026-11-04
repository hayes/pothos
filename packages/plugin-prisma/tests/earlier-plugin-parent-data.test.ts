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

interface ScopedOptions {
  authScopes?: Recorder;
  grantScopes?: () => string[];
  skipInterfaceScopes?: boolean;
}

// Stands in for scope-auth, which can't be a dev dependency here (scope-auth depends on this
// package), and is registered under its name, which the prisma plugin checks for: it calls the field's, the parent type's and its interfaces' `recordParent` with the
// parent its wrapper receives, as scope-auth calls `authScopes`. A recorder that throws denies. An
// interface's `authScopes` option, which this builder's types don't know, runs as one too.
const pluginName = 'scopeAuth' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;

class RecordParentPlugin extends BasePlugin<SchemaTypes> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, object, object>,
    fieldConfig: PothosOutputFieldConfig<SchemaTypes>,
  ): GraphQLFieldResolver<unknown, object, object> {
    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const recorders = [
      parentConfig.extensions?.recordParent,
      ...(parentConfig.kind === 'Object' || parentConfig.kind === 'Interface'
        ? parentConfig.interfaces.flatMap((iface) => {
            const { extensions, pothosOptions } = this.buildCache.getTypeConfig(iface);

            return [extensions?.recordParent, (pothosOptions as ScopedOptions).authScopes];
          })
        : []),
      fieldConfig.extensions?.recordParent,
    ].filter(Boolean) as Recorder[];

    if (recorders.length === 0) {
      return resolver;
    }

    return (parent, args, context, info) => {
      for (const recorder of recorders) {
        recorder(parent as never);
      }

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

const seen: {
  type: unknown[];
  field: unknown[];
  typeInclude: unknown[];
  impl: unknown[];
  iface: unknown[];
  customProfile: unknown[];
  redacted: unknown[];
  conflict: unknown[];
} = {
  type: [],
  field: [],
  typeInclude: [],
  impl: [],
  iface: [],
  customProfile: [],
  redacted: [],
  conflict: [],
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

// Stands in for a check that reads the type's posts: it allows only when they include a draft,
// which the type's filter never loads, so it always denies.
const PublishedAuthor = builder.prismaObject('User', {
  variant: 'PublishedAuthor',
  include: { posts: { where: { published: true } } },
  extensions: {
    recordParent: (user: { posts?: { published: boolean }[] }) => {
      if (!user.posts?.some((post) => !post.published)) {
        throw new Error('Not authorized');
      }
    },
  },
  fields: (t) => ({
    // Selects the author's posts without the type's filter.
    postCount: t.int({
      select: () => ({ posts: true }),
      resolve: (user) => user.posts.length,
    }),
  }),
});

// The interface's type-level checks run on its implementation's fields, as scope-auth runs them.
const ProfileIface = builder.prismaInterface('User', {
  variant: 'ProfileIface',
  select: { profile: { select: { bio: true } } },
  resolveType: () => 'NoProfileImpl',
  extensions: { recordParent: recordProfile(seen.iface) },
  fields: (t) => ({
    profileIfaceId: t.exposeID('id'),
  }),
});

const NoProfileImpl = builder.prismaObject('User', {
  variant: 'NoProfileImpl',
  // @ts-expect-error The shape lacks the interface's select, which a row built by hand can too.
  interfaces: [ProfileIface],
  select: { id: true },
  fields: () => ({}),
});

// Opted out of fallback queries.
const NoFallbackUser = builder.prismaObject('User', {
  variant: 'NoFallbackUser',
  findUnique: null,
  include: { profile: true },
  extensions: { recordParent: recordProfile(seen.typeInclude) },
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

builder.prismaObject('Profile', {
  fields: (t) => ({
    bio: t.exposeString('bio', { nullable: true }),
  }),
});

const CustomRelationUser = builder.prismaObject('User', {
  variant: 'CustomRelationUser',
  select: { id: true, email: true },
  fields: (t) => ({
    profile: t.relation('profile', {
      nullable: true,
      resolve: (_query, user) => {
        seen.customProfile.push(user.id);

        return null;
      },
    }),
  }),
});

const RedactedUser = builder.prismaObject('User', {
  variant: 'RedactedUser',
  include: { profile: true },
  extensions: { recordParent: (user: Row) => seen.redacted.push(user.email) },
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

// The interface and its implementation filter the same relation differently.
const DraftsIface = builder.prismaInterface('User', {
  variant: 'DraftsIface',
  include: { posts: { where: { published: false } } },
  resolveType: () => 'PublishedImpl',
  fields: (t) => ({
    draftsIfaceId: t.exposeID('id'),
  }),
});

const PublishedImpl = builder.prismaObject('User', {
  variant: 'PublishedImpl',
  interfaces: [DraftsIface],
  include: { posts: { where: { published: true } } },
  extensions: {
    recordParent: (user: { posts?: { published: boolean }[] }) =>
      seen.conflict.push(user.posts?.every((post) => post.published)),
  },
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

// Denies unless the posts its include loads, which match nothing, are there. A row can't hold its
// posts and its implementation's at once.
const restrictedScopes: ScopedOptions = {
  authScopes: (user: { posts?: unknown[] }) => {
    if (!user.posts?.length) {
      throw new Error('Not authorized');
    }
  },
};

const RestrictedIface = builder.prismaInterface('User', {
  ...restrictedScopes,
  variant: 'RestrictedIface',
  include: { posts: { where: { id: { lt: 0 } } } },
  resolveType: () => 'RestrictedImpl',
  fields: (t) => ({
    restrictedId: t.exposeID('id', { nullable: true }),
  }),
});

const RestrictedImpl = builder.prismaObject('User', {
  variant: 'RestrictedImpl',
  interfaces: [RestrictedIface],
  include: { posts: { where: { published: true } } },
  fields: (t) => ({
    secret: t.string({ nullable: true, resolve: () => 'secret' }),
  }),
});

// Only grants, from posts its include loads, which match nothing.
const grantingScopes: ScopedOptions = { grantScopes: () => [] };

const GrantingIface = builder.prismaInterface('User', {
  ...grantingScopes,
  variant: 'GrantingIface',
  include: { posts: { where: { id: { lt: 0 } } } },
  resolveType: () => 'GrantingImpl',
  fields: (t) => ({
    grantingId: t.exposeID('id', { nullable: true }),
  }),
});

const GrantingImpl = builder.prismaObject('User', {
  variant: 'GrantingImpl',
  interfaces: [GrantingIface],
  include: { posts: { where: { published: true } } },
  fields: () => ({}),
});

// Its interfaces' checks never run on its fields.
const skippingScopes: ScopedOptions = { skipInterfaceScopes: true };

const SkippingImpl = builder.prismaObject('User', {
  ...skippingScopes,
  variant: 'SkippingImpl',
  interfaces: [RestrictedIface],
  include: { posts: { where: { published: true } } },
  fields: (t) => ({
    open: t.string({ resolve: () => 'open' }),
  }),
});

builder.queryType({
  fields: (t) => ({
    granting: t.field({
      type: GrantingImpl,
      nullable: true,
      resolve: () => ({ id: 1 }) as never,
    }),
    skipping: t.field({
      type: SkippingImpl,
      resolve: () => ({ id: 1 }) as never,
    }),
    restricted: t.field({
      type: RestrictedImpl,
      nullable: true,
      resolve: () => ({ id: 1 }) as never,
    }),
    partialPublishedImpl: t.field({
      type: PublishedImpl,
      resolve: () => ({ id: 1 }) as never,
    }),
    redacted: t.field({
      type: RedactedUser,
      resolve: async () =>
        ({
          ...(await prisma.user.findUniqueOrThrow({ where: { id: 1 } })),
          email: 'redacted',
        }) as never,
    }),
    plainPublishedImpl: t.field({
      type: PublishedImpl,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }) as never,
    }),
    plainAuthor: t.field({
      type: PublishedAuthor,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }) as never,
    }),
    partialNoProfileImpl: t.field({
      type: NoProfileImpl,
      resolve: () => ({ id: 1 }) as never,
    }),
    plainNoFallback: t.field({
      type: NoFallbackUser,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }) as never,
    }),
    partialCustomRelation: t.field({
      type: CustomRelationUser,
      resolve: () => ({ id: 1 }) as never,
    }),
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
    seen.iface.length = 0;
    seen.customProfile.length = 0;
    seen.redacted.length = 0;
    seen.conflict.length = 0;
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

  it("a field's select is loaded for its resolver, after earlier plugins run", async () => {
    const result = await execute({
      schema,
      document: gql`{ plain { id bio } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plain: { id: '1', bio: user.profile?.bio ?? null } });
    // The row has the type's select, so nothing is reloaded before the field's checks run.
    expect(seen.field).toEqual(['missing']);
    // The root query and one batched reload, as before.
    expect(queries).toHaveLength(2);
  });

  it('a function select is planned, but not loaded before earlier plugins run', async () => {
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
    expect(plain.data).toEqual({ plain: { bioFromFunction: user.profile?.bio ?? null } });
    expect(seen.field).toEqual([user.profile?.bio, 'missing']);
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
    // The type's select, then the `id` field's own reload.
    expect(queries).toHaveLength(2);
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
    // The root query, the type-level selections, then the field's own reload.
    expect(queries).toHaveLength(3);

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
  it("a field's select doesn't replace the type's filtered relation the type's checks read", async () => {
    const result = await execute({
      schema,
      document: gql`{ plainAuthor { postCount } }`,
      contextValue: {},
    });

    expect(result.data).toEqual({ plainAuthor: { postCount: null } });
    expect(result.errors?.map((error) => error.message)).toEqual(['Not authorized']);
  });

  it("an inherited field's row the plugin didn't load gets its interface's select", async () => {
    const result = await execute({
      schema,
      document: gql`{ partialNoProfileImpl { profileIfaceId } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seen.iface).toEqual([user.profile?.bio]);
  });

  it('a type that opted out of fallback queries is not reloaded', async () => {
    const result = await execute({
      schema,
      document: gql`{ plainNoFallback { email } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plainNoFallback: { email: user.email } });
    expect(seen.typeInclude).toEqual(['missing']);
    expect(queries).toHaveLength(1);
  });

  it('a reload fills what the row is missing without replacing what it has', async () => {
    const result = await execute({
      schema,
      document: gql`{ redacted { email } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ redacted: { email: 'redacted' } });
    expect(seen.redacted).toEqual(['redacted']);
  });

  it("an interface whose select conflicts with its implementation's is left out of the reload", async () => {
    const result = await execute({
      schema,
      document: gql`{ plainPublishedImpl { email } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ plainPublishedImpl: { email: user.email } });
    expect(seen.conflict).toEqual([true]);
  });

  it("a conflicting interface without checks doesn't block the fields it declares", async () => {
    const result = await execute({
      schema,
      document: gql`{ partialPublishedImpl { draftsIfaceId } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ partialPublishedImpl: { draftsIfaceId: '1' } });
    // The implementation's filter wins, as it does on a row planned for it.
    expect(seen.conflict).toEqual([true]);
  });

  it.each([
    ['its implementation', 'secret'],
    ['itself', 'restrictedId'],
  ])("a reload can't check an interface's authScopes on a field %s declares when their selects conflict", async (_declarer, field) => {
    const result = await execute({
      schema,
      document: gql`{ restricted { ${field} } }`,
      contextValue: {},
    });

    expect(result.data).toEqual({ restricted: { [field]: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Type-level selections of RestrictedIface and RestrictedImpl conflict on relation "posts", so RestrictedIface\'s scope checks can\'t run on a row Pothos reloads. Move the relation arguments to a field-level select on one of the types.',
    ]);
    expect(queries).toHaveLength(0);
  });

  it("a reload can't run a conflicting interface's grantScopes on the fields it declares", async () => {
    const result = await execute({
      schema,
      document: gql`{ granting { grantingId } }`,
      contextValue: {},
    });

    expect(result.data).toEqual({ granting: { grantingId: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Type-level selections of GrantingIface and GrantingImpl conflict on relation "posts", so GrantingIface\'s scope checks can\'t run on a row Pothos reloads. Move the relation arguments to a field-level select on one of the types.',
    ]);
    expect(queries).toHaveLength(0);
  });

  it("a type that skips its interfaces' scopes is reloaded despite their conflict", async () => {
    const result = await execute({
      schema,
      document: gql`{ skipping { open } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ skipping: { open: 'open' } });
  });

  it("a relation's own resolver still runs for a row reloaded with the type's select", async () => {
    const result = await execute({
      schema,
      document: gql`{ partialCustomRelation { profile { bio } } }`,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ partialCustomRelation: { profile: null } });
    expect(seen.customProfile).toEqual([1]);
  });
});
