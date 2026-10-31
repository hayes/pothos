import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import type { PostgresClient } from '@prisma/orm-postgres/runtime';
import type { SqliteClient } from '@prisma/orm-sqlite/runtime';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { type CollectionFor, type ModelName, type Row } from '../../src';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as PostgresContract } from '../postgres/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;
type UserRow = DefaultModelRow<Contract, 'User'>;
type PostRow = DefaultModelRow<Contract, 'Post'>;

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
const collection = null as never;
declare const orm: { User: CollectionFor<Types, 'User'>; Post: CollectionFor<Types, 'Post'> };

expectTypeOf<ModelName<Types>>().toEqualTypeOf<'User' | 'Post' | 'Comment' | 'PostView'>();
expectTypeOf<Row<Types, 'User'>>().toEqualTypeOf<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}>();

// A resolver's parent holds the brand, the primary key (always loaded) and the columns its field
// and type declare, nothing else.
builder.prismaObject('User', {
  variant: 'FieldSelects',
  fields: (t) => ({
    fullName: t.string({
      select: ['firstName', 'lastName'],
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        // @ts-expect-error `email` isn't selected
        user.email;
        return `${user.firstName} ${user.lastName}`;
      },
    }),
    nothing: t.string({
      // @ts-expect-error no select means no columns on the parent
      resolve: (user) => user.email,
    }),
    key: t.id({
      resolve: (user) => {
        expectTypeOf(user.id).toEqualTypeOf<string>();
        return user.id;
      },
    }),
    typo: t.string({
      // @ts-expect-error `frstName` isn't a column, even beside a valid one
      select: ['firstName', 'frstName'],
      resolve: () => '',
    }),
    objectTypo: t.string({
      // @ts-expect-error `titel` isn't a column or relation
      select: { titel: true },
      resolve: () => '',
    }),
    relation: t.string({
      select: { email: true, posts: true },
      resolve: (user) => {
        expectTypeOf(user.posts).toEqualTypeOf<readonly PostRow[]>();
        return user.email;
      },
    }),
    paged: t.string({
      select: { posts: { limit: 2, offset: 1 } },
      resolve: (user) => {
        expectTypeOf(user.posts).toEqualTypeOf<readonly PostRow[]>();
        return '';
      },
    }),
  }),
});

builder.prismaObject('User', {
  variant: 'TypeSelects',
  select: { email: true },
  fields: (t) => ({
    domain: t.string({ resolve: (user) => user.email }),
    signature: t.string({
      select: ['firstName'],
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        return '';
      },
    }),
  }),
});

builder.prismaObject('User', {
  variant: 'SelectArrayTypo',
  // @ts-expect-error `firstNme` isn't a column
  select: ['firstNme'],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'SelectColumnShape',
  // @ts-expect-error columns take `true`, not a refinement
  select: { email: { limit: 1 } },
  fields: () => ({}),
});
builder.prismaInterface('User', {
  name: 'SelectInterfaceTypo',
  // @ts-expect-error `postz` isn't a column or relation
  select: { postz: true },
  fields: () => ({}),
});
builder.prismaNode('User', {
  variant: 'NodeSelectTypo',
  id: { field: 'id' },
  collection,
  // @ts-expect-error `emial` isn't a column, even beside a valid one
  select: { email: true, emial: true },
  fields: () => ({}),
});
builder.prismaNode('User', {
  variant: 'NodeRelationTypo',
  id: { field: 'id' },
  collection,
  // @ts-expect-error `psots` isn't a relation, even beside a valid one
  select: { posts: true, psots: { limit: 3 } },
  fields: () => ({}),
});
builder.prismaNode('User', {
  variant: 'NodeArrayTypo',
  id: { field: 'id' },
  collection,
  // @ts-expect-error `emial` isn't a column, even beside a valid one
  select: ['email', 'emial'],
  fields: () => ({}),
});
declare const eitherSelect: readonly ['id'] | { readonly id: true };
builder.prismaObject('User', { variant: 'SelectUnion', select: eitherSelect, fields: () => ({}) });

// Function-form selects type `sub` as the relation's collection and put their keys on the row.
builder.prismaObject('User', {
  variant: 'FunctionSelects',
  select: { posts: (sub) => ({ postCount: sub.count() }) },
  fields: (t) => ({
    postCount: t.int({
      resolve: (user) => {
        expectTypeOf(user.postCount).toEqualTypeOf<number>();
        return user.postCount;
      },
    }),
    stats: t.field({
      type: 'Float',
      nullable: true,
      select: {
        posts: (sub) => ({
          total: sub.count(),
          published: sub.where((p) => p.published.eq(1)).count(),
          avg: sub.avg('published'),
          max: sub.max('score'),
          rows: sub.where({ published: 1 }),
        }),
      },
      resolve: (user) => {
        expectTypeOf(user.total).toEqualTypeOf<number>();
        expectTypeOf(user.published).toEqualTypeOf<number>();
        expectTypeOf(user.avg).toEqualTypeOf<number | null>();
        expectTypeOf(user.max).toEqualTypeOf<number | null>();
        expectTypeOf(user.rows).toEqualTypeOf<readonly PostRow[]>();
        return user.avg;
      },
    }),
  }),
});
builder.prismaObject('User', {
  variant: 'FunctionSelectBadMethod',
  // @ts-expect-error `sub` is typed, so an unknown method is rejected
  select: { posts: (sub) => ({ n: sub.nope() }) },
  fields: () => ({}),
});
builder.prismaInterface('User', {
  name: 'InterfaceFunctionSelect',
  select: { posts: (sub) => ({ postCount: sub.count() }) },
  fields: (t) => ({ postCount: t.int({ resolve: (user) => user.postCount }) }),
});
builder.prismaNode('User', {
  variant: 'NodeFunctionSelect',
  id: { field: 'id' },
  collection,
  select: { posts: (sub) => ({ postCount: sub.count() }) },
  fields: (t) => ({ postCount: t.int({ resolve: (user) => user.postCount }) }),
});

// Every type's selection loads the primary key, so a parent passes through to another type of
// its model without a `select`.
const UserKeyOnly = builder.prismaObject('User', { variant: 'UserKeyOnly', fields: () => ({}) });
builder.prismaObject('User', {
  variant: 'PassThrough',
  fields: (t) => ({
    same: t.field({ type: UserKeyOnly, resolve: (user) => user }),
  }),
});

// A field `select` may be a function of the field's args and context, sync or async: what it
// returns narrows the parent and is checked like a literal select.
declare const someColumns: ('email' | 'firstName')[];
builder.prismaObject('User', {
  variant: 'FieldSelectFunctions',
  fields: (t) => ({
    columns: t.string({
      select: () => ['email'],
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        // @ts-expect-error `lastName` isn't selected
        return user.lastName;
      },
    }),
    asyncColumns: t.string({ select: async () => ['email'], resolve: (user) => user.email }),
    objectForm: t.string({
      select: () => ({ email: true, posts: true }),
      resolve: (user) => `${user.email}${user.posts.length}`,
    }),
    asyncObjectForm: t.string({
      select: async () => ({ email: true }),
      resolve: (user) => user.email,
    }),
    computed: t.int({
      args: { published: t.arg.int({ required: true }) },
      select: (args) => ({
        posts: (sub) => ({ postCount: sub.where({ published: args.published }).count() }),
      }),
      resolve: (user) => user.postCount,
    }),
    // Columns only some branches select may be missing.
    branches: t.string({
      args: { formal: t.arg.boolean({ required: true }) },
      select: (args) => (args.formal ? ['lastName'] : ['firstName']),
      resolve: (user) => {
        expectTypeOf(user.lastName).toEqualTypeOf<string | undefined>();
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    // Overlapping branches keep apart, so a column only one of them selects may be missing.
    overlapping: t.string({
      args: { full: t.arg.boolean({ required: true }) },
      select: (args) => (args.full ? ['email', 'firstName'] : ['email']),
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string | undefined>();
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    emptyBranch: t.string({
      args: { full: t.arg.boolean({ required: true }) },
      select: (args) => (args.full ? ['lastName'] : []),
      resolve: (user) => {
        expectTypeOf(user.lastName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    statementBranches: t.string({
      args: { full: t.arg.boolean({ required: true }) },
      select: (args) => {
        if (args.full) {
          return ['email', 'firstName'];
        }
        return ['email'];
      },
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    asyncOverlapping: t.string({
      args: { full: t.arg.boolean({ required: true }) },
      select: async (args) => (args.full ? ['email', 'firstName'] : ['email']),
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    singleBranch: t.string({
      select: () => ['email', 'firstName'],
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        return '';
      },
    }),
    asyncSingleBranch: t.string({
      select: async () => ['email', 'firstName'],
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        return '';
      },
    }),
    // An array variable may hold any of its columns.
    variable: t.string({
      select: () => someColumns,
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    relationQuery: t.int({
      select: () => ({ posts: { limit: 2, where: { published: 1 } } }),
      resolve: (user) => user.posts.length,
    }),
    relationQueryValue: t.int({
      // @ts-expect-error `limit` takes a number
      select: () => ({ posts: { limit: 'x' } }),
      resolve: () => 1,
    }),
    asyncRelationQueryValue: t.int({
      // @ts-expect-error `limit` takes a number
      select: async () => ({ posts: { limit: 'x' } }),
      resolve: () => 1,
    }),
    columnValue: t.int({
      // @ts-expect-error a column takes `true`
      select: () => ({ email: { limit: 1 } }),
      resolve: () => 1,
    }),
    columnTypo: t.string({
      // @ts-expect-error `emial` isn't a column
      select: () => ['emial'],
      resolve: () => '',
    }),
    objectTypo: t.string({
      // @ts-expect-error `emial` isn't a column
      select: () => ({ emial: true }),
      resolve: () => '',
    }),
    asyncTypo: t.string({
      // @ts-expect-error `emial` isn't a column
      select: async () => ['emial'],
      resolve: () => '',
    }),
  }),
});

// Implementations of a same-model prismaInterface load its `select`, so they can read it too.
const EmailInterface = builder.prismaInterface('User', {
  name: 'EmailInterface',
  select: ['email'],
  fields: (t) => ({ email: t.string({ resolve: (user) => user.email }) }),
});
const EmailAndNameInterface = builder.prismaInterface('User', {
  name: 'EmailAndNameInterface',
  interfaces: [EmailInterface],
  select: ['firstName'],
  fields: (t) => ({ label: t.string({ resolve: (user) => `${user.firstName} ${user.email}` }) }),
});
builder.prismaObject('User', {
  variant: 'InheritsInterfaceSelect',
  interfaces: [EmailAndNameInterface, EmailInterface],
  select: ['lastName'],
  fields: (t) => ({
    label: t.string({
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        return user.lastName;
      },
    }),
  }),
});
builder.prismaNode('User', {
  variant: 'NodeInheritsInterfaceSelect',
  interfaces: [EmailInterface],
  id: { field: 'id' },
  collection,
  fields: (t) => ({ email: t.string({ resolve: (user) => user.email }) }),
});
builder.prismaObject('Post', {
  variant: 'OtherModelInterface',
  // @ts-expect-error a User interface's select can't back a Post object
  interfaces: [EmailInterface],
  fields: () => ({}),
});

// A field returning a type resolves to a row of its model carrying the key the loader reloads it
// by, whatever the type selects.
const PlainUser = builder.prismaObject('User', {
  variant: 'PlainUser',
  fields: (t) => ({ id: t.exposeID('id') }),
});
const EmailUser = builder.prismaObject('User', {
  variant: 'EmailUser',
  select: ['email'],
  fields: (t) => ({ email: t.exposeString('email') }),
});
builder.prismaObject('Post', {
  variant: 'ReturnsRows',
  fields: (t) => ({
    selectedAuthor: t.field({
      type: PlainUser,
      select: { author: true },
      resolve: (post) => post.author,
    }),
    keyOnly: t.field({ type: EmailUser, resolve: () => ({ id: 'u-1' }) }),
    rows: t.field({ type: [PlainUser], resolve: () => orm.User.all() }),
    // @ts-expect-error an empty object has no key to reload it by
    empty: t.field({ type: PlainUser, resolve: () => ({}) }),
    // @ts-expect-error a row without its key can't be reloaded
    keyless: t.field({ type: EmailUser, resolve: () => ({ email: 'a@b.c' }) }),
    // @ts-expect-error an unexecuted collection is for prismaField
    collection: t.field({ type: PlainUser, resolve: () => orm.User }),
  }),
});
builder.queryField('firstUser', (t) =>
  t.field({ type: PlainUser, nullable: true, resolve: () => orm.User.first() }),
);

// A required to-one relation is non-null when selected; a filtered selection can be null.
builder.prismaObject('Post', {
  variant: 'ToOneSelects',
  select: { author: true },
  fields: (t) => ({
    typeLevel: t.string({
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<UserRow>();
        return post.author.firstName;
      },
    }),
    ordered: t.string({
      select: { author: { limit: 1 } },
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<UserRow>();
        return '';
      },
    }),
    filtered: t.string({
      select: { author: { where: { firstName: 'Alice' } } },
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<UserRow | null>();
        return '';
      },
    }),
  }),
});
builder.prismaObject('Post', {
  variant: 'FilteredTypeSelect',
  select: { author: { where: { firstName: 'Alice' } } },
  fields: (t) => ({
    name: t.string({
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<UserRow | null>();
        return '';
      },
    }),
  }),
});

// String-form cross-file helpers see only their own declared columns; ref forms see the type's.
builder.prismaObjectField('User', 'undeclaredObjectField', (t) =>
  // @ts-expect-error The string form's parent carries only declared dependencies.
  t.string({ resolve: (user) => user.email }),
);
builder.prismaObjectFields('User', (t) => ({
  // @ts-expect-error The string form's parent carries only declared dependencies.
  undeclaredObjectFields: t.string({ resolve: (user) => user.email }),
  declared: t.string({
    select: { email: true, posts: true },
    resolve: (user) => {
      expectTypeOf(user.posts).toEqualTypeOf<readonly PostRow[]>();
      return user.email;
    },
  }),
  exposed: t.exposeString('firstName'),
  related: t.relation('posts'),
}));
builder.prismaInterfaceField('User', 'undeclaredInterfaceField', (t) =>
  // @ts-expect-error The string form's parent carries only declared dependencies.
  t.string({ resolve: (user) => user.email }),
);
builder.prismaInterfaceFields('User', (t) => ({
  declaredOnInterface: t.string({ select: ['lastName'], resolve: (user) => user.lastName }),
}));
const BareUser = builder.prismaObject('User', { variant: 'BareUser', fields: () => ({}) });
builder.prismaObjectField(BareUser, 'undeclaredViaRef', (t) =>
  // @ts-expect-error The ref's shape carries only what the object declared.
  t.string({ resolve: (user) => user.email }),
);
const SelectedUser = builder.prismaObject('User', {
  variant: 'SelectedUser',
  select: ['email'],
  fields: () => ({}),
});
builder.prismaObjectFields(SelectedUser, (t) => ({
  declaredViaRef: t.string({ resolve: (user) => user.email }),
}));
builder.prismaObjectField<'User', Row<Types, 'User'>>('User', 'escapeHatch', (t) =>
  t.string({ resolve: (user) => user.email }),
);

// Type-level callbacks read the type's selected columns without a cast.
builder.prismaObject('Comment', {
  select: ['body'],
  isTypeOf: (comment) => comment.body.length > 0,
  fields: () => ({}),
});
builder.prismaObject('Comment', {
  variant: 'CommentUnselected',
  select: ['body'],
  // @ts-expect-error only selected columns are on the row
  isTypeOf: (comment) => comment.createdAt !== null,
  fields: () => ({}),
});
builder.prismaInterface('Comment', {
  variant: 'CommentInterface',
  select: ['body'],
  resolveType: (comment) => (comment.body ? 'Comment' : null),
  fields: () => ({}),
});
builder.prismaInterface('Comment', {
  variant: 'CommentInterfaceIsTypeOf',
  // @ts-expect-error `isTypeOf` belongs to object types
  isTypeOf: () => true,
  fields: () => ({}),
});
builder.prismaObject('User', {
  // @ts-expect-error variant must be a string
  variant: 42,
  fields: () => ({}),
});

// A relation entry takes only `where`, `orderBy`, `limit` and `offset`.
builder.prismaObject('User', {
  variant: 'RelationQueryKeys',
  // @ts-expect-error `take` isn't a relation query option
  select: { posts: { take: 2 } },
  fields: (t) => ({
    field: t.string({
      // @ts-expect-error `take` isn't a relation query option, even beside a valid one
      select: { posts: { where: { published: 1 }, take: 2 } },
      resolve: () => '',
    }),
    valid: t.string({
      select: { posts: { where: { published: 1 }, limit: 2 } },
      resolve: (user) => user.posts.map((post) => post.title).join(','),
    }),
  }),
});

// `addBrand` takes the rows a collection returns and brands them for abstract positions.
const BrandedUser = builder.prismaObject('User', {
  variant: 'BrandedUser',
  select: ['email'],
  fields: (t) => ({ email: t.exposeString('email') }),
});
const BrandedPost = builder.prismaObject('Post', {
  variant: 'BrandedPost',
  fields: (t) => ({ id: t.exposeID('id') }),
});
const SearchResult = builder.unionType('SearchResult', { types: [BrandedUser, BrandedPost] });
builder.queryField('search', (t) =>
  t.field({
    type: [SearchResult],
    resolve: async () => {
      const users = BrandedUser.addBrand(await orm.User.all());
      expectTypeOf(users[0]).toExtend<UserRow>();
      return [...users, ...BrandedPost.addBrand(await orm.Post.all())];
    },
  }),
);
builder.queryField('searchOne', (t) =>
  t.field({
    type: SearchResult,
    nullable: true,
    resolve: async () => {
      const user = await orm.User.first();
      return user && BrandedUser.addBrand(user);
    },
  }),
);
// @ts-expect-error a row needs the columns the type selects
BrandedUser.addBrand({ id: 'u-1' });

// Root resolvers return an unexecuted Collection of the field's model.
const PostInterface = builder.prismaInterface('Post', {
  fields: (t) => ({ id: t.exposeID('id') }),
});
builder.queryType({
  fields: (t) => ({
    users: t.prismaField({ type: ['User'], resolve: () => orm.User.orderBy((u) => u.id.asc()) }),
    posts: t.prismaField({ type: [PostInterface], resolve: () => orm.Post }),
    post: t.prismaField({ type: PostInterface, nullable: true, resolve: () => null }),
    wrongModel: t.prismaField({
      type: ['User'],
      // @ts-expect-error a Post collection can't resolve User rows
      resolve: () => orm.Post,
    }),
    rows: t.prismaField({
      type: ['User'],
      // @ts-expect-error rows can't satisfy future nested selections
      resolve: () => [{ id: '1', firstName: 'a', lastName: 'b', email: 'a@b' }],
    }),
    row: t.prismaField({
      type: 'User',
      // @ts-expect-error root resolvers return selection-aware collections
      resolve: () => ({ id: '1', firstName: 'a', lastName: 'b', email: 'a@b' }),
    }),
    materialized: t.prismaField({
      type: ['User'],
      // @ts-expect-error rows must be returned as an unexecuted Collection
      resolve: () => orm.User.all(),
    }),
    // @ts-expect-error not a model in the contract
    unknown: t.prismaField({ type: ['Tag'], resolve: () => orm.User }),
  }),
});

// @ts-expect-error not a model in the contract
builder.prismaObject('Tag', { fields: () => ({}) });

// Without PrismaNextContract, model names collapse to a sentinel.
new SchemaBuilder({ plugins: [prismaNextPlugin], prismaNext: { client: null as never } })
  // @ts-expect-error without PrismaNextContract, model names collapse to a sentinel
  .prismaObject('User', { fields: () => ({}) });

// prismaFieldWithInput: an optional input may be omitted as well as null.
const withInput = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [WithInputPlugin, prismaNextPlugin],
  prismaNext: { client: null as never },
});
withInput.queryType({
  fields: (t) => ({
    optional: t.prismaFieldWithInput({
      type: 'User',
      nullable: true,
      argOptions: { required: false },
      input: { email: t.input.string({ required: true }) },
      resolve: (_root, args) => {
        expectTypeOf(args.input).toEqualTypeOf<{ email: string } | null | undefined>();
        if (args.input === null) {
          return null;
        }
        // @ts-expect-error `input` is still possibly undefined
        args.input.email;
        return null;
      },
    }),
    required: t.prismaFieldWithInput({
      type: 'User',
      nullable: true,
      input: { email: t.input.string({ required: true }) },
      resolve: (_root, args) => {
        expectTypeOf(args.input).toEqualTypeOf<{ email: string }>();
        return null;
      },
    }),
  }),
});

// client: the client itself, or a function of the request context that returns one (such as a
// transaction) beside the contract.
type Context = { db: typeof db; tenantId: string };
declare const db: { orm: typeof orm; context: { contract: Contract; contractCodecs: Codecs } };
type Codecs = { forColumn(namespaceId: string, table: string, column: string): unknown };
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: db },
});
declare const sqliteClient: SqliteClient<Contract>;
declare const postgresClient: PostgresClient<PostgresContract>;
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: sqliteClient },
});
new SchemaBuilder<{ PrismaNextContract: Contract; Context: Context }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    client: () => null as unknown as Parameters<Parameters<typeof sqliteClient.transaction>[0]>[0],
    contract: sqliteClient.contract,
  },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  // @ts-expect-error a client of another contract
  prismaNext: { client: postgresClient },
});
new SchemaBuilder<{ PrismaNextContract: Contract; Context: Context }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    client: (context) => {
      expectTypeOf(context).toEqualTypeOf<Context>();
      return { orm: context.db.orm };
    },
    contract: db.context.contract,
  },
});
new SchemaBuilder<{ PrismaNextContract: Contract; Context: Context }>({
  plugins: [prismaNextPlugin],
  // @ts-expect-error a client function needs the contract for building the schema
  prismaNext: { client: (context) => context.db },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  // @ts-expect-error the client is required
  prismaNext: {},
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  // @ts-expect-error a client's contract already describes the schema
  prismaNext: { client: db, contract: db.context.contract },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    client: db,
    // @ts-expect-error unknown options are rejected
    collections: db.orm,
  },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    // @ts-expect-error the client needs its execution context
    client: { orm: db.orm },
  },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    // @ts-expect-error a client's collections belong to the contract's models
    client: { orm: { User: orm.Post }, context: db.context },
  },
});
