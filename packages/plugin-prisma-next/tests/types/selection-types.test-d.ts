import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import type { PostgresClient } from '@prisma/orm-postgres/runtime';
import type { SqliteClient } from '@prisma/orm-sqlite/runtime';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, {
  type CollectionFor,
  type ModelKey,
  type PrismaNextExecutionContext,
  prismaConnectionHelpers,
  type Row,
} from '../../src';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';
import type { Contract as PostgresContract } from '../postgres/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;
type UserRow = DefaultModelRow<Contract, 'User'>;
type PostRow = DefaultModelRow<Contract, 'Post'>;

const builder = new SchemaBuilder<{ PrismaNextContract: Contract; AsyncSelections: true }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
const collection = null as never;
declare const orm: { User: CollectionFor<Types, 'User'>; Post: CollectionFor<Types, 'Post'> };

expectTypeOf<ModelKey<Types>>().toEqualTypeOf<'User' | 'Post' | 'Comment' | 'PostView'>();
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
builder.prismaObject('User', {
  variant: 'FunctionSelectCollection',
  // @ts-expect-error the function returns an object of values to load, not the collection
  select: { posts: (sub) => sub },
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'FunctionSelectReducer',
  // @ts-expect-error a reducer needs a key on the returned object
  select: { posts: (sub) => sub.count() },
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
      select: () => ({ email: true }),
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        // @ts-expect-error `lastName` isn't selected
        return user.lastName;
      },
    }),
    // A function returns the object form. A column array is a static `select` only.
    // @ts-expect-error a select function returns a select object
    arrayFromFunction: t.string({ select: () => ['email'], resolve: () => '' }),
    // @ts-expect-error a select function returns a select object
    arrayFromAsyncFunction: t.string({ select: async () => ['email'], resolve: () => '' }),
    // @ts-expect-error a select function returns a select object, even with known columns
    tupleFromFunction: t.string({ select: () => ['email'] as const, resolve: () => '' }),
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
    collection: t.string({
      // @ts-expect-error the function returns an object of values to load, not the collection
      select: { posts: (sub) => sub },
      resolve: () => '',
    }),
    // Columns only some branches select may be missing.
    branches: t.string({
      args: { formal: t.arg.boolean({ required: true }) },
      select: (args) => (args.formal ? { lastName: true } : { firstName: true }),
      resolve: (user) => {
        expectTypeOf(user.lastName).toEqualTypeOf<string | undefined>();
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    // A column every branch selects is present; one only some branches select may be missing.
    overlapping: t.string({
      args: { full: t.arg.boolean({ required: true }) },
      select: (args) => (args.full ? { email: true, firstName: true } : { email: true }),
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    emptyBranch: t.string({
      args: { full: t.arg.boolean({ required: true }) },
      select: (args) => (args.full ? { lastName: true } : {}),
      resolve: (user) => {
        expectTypeOf(user.lastName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    statementBranches: t.string({
      args: { full: t.arg.boolean({ required: true }) },
      select: (args) => {
        if (args.full) {
          return { email: true, firstName: true };
        }
        return { email: true };
      },
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    asyncOverlapping: t.string({
      args: { full: t.arg.boolean({ required: true }) },
      select: async (args) => (args.full ? { email: true, firstName: true } : { email: true }),
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
    singleBranch: t.string({
      select: () => ({ email: true, firstName: true }),
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        return '';
      },
    }),
    asyncSingleBranch: t.string({
      select: async () => ({ email: true, firstName: true }),
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        return '';
      },
    }),
    // An array variable may hold any of its columns.
    staticVariable: t.string({
      select: someColumns,
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
      select: () => ({ email: true, emial: true }),
      resolve: () => '',
    }),
    objectTypo: t.string({
      // @ts-expect-error `emial` isn't a column
      select: () => ({ emial: true }),
      resolve: () => '',
    }),
    asyncTypo: t.string({
      // @ts-expect-error `emial` isn't a column
      select: async () => ({ emial: true }),
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
    // @ts-expect-error a returned row holds what the type's select loads
    keyOnly: t.field({ type: EmailUser, resolve: () => ({ id: 'u-1' }) }),
    withSelected: t.field({ type: EmailUser, resolve: () => ({ id: 'u-1', email: 'a@b.c' }) }),
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

// A required to-one relation is non-null when selected. It takes only `true`.
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
      // @ts-expect-error a to-one relation takes only `true`
      select: { author: { limit: 1 } },
      resolve: () => '',
    }),
    filtered: t.string({
      // @ts-expect-error a to-one relation takes only `true`
      select: { author: { where: { firstName: 'Alice' } } },
      resolve: () => '',
    }),
  }),
});
// A type's select takes only `true` for a to-one relation.
builder.prismaObject('Post', {
  variant: 'FilteredTypeSelect',
  // @ts-expect-error a to-one relation in a type's select takes only true
  select: { author: { where: { firstName: 'Alice' } } },
});
builder.prismaObject('Post', {
  variant: 'LimitedTypeSelect',
  // @ts-expect-error a to-one relation in a type's select takes no query options either
  select: { author: { limit: 1 } },
});
builder.prismaInterface('Post', {
  name: 'FilteredInterfaceSelect',
  // @ts-expect-error prismaInterface's select takes only true for a to-one relation too
  select: { author: { where: { firstName: 'Alice' } } },
});
builder.prismaNode('Post', {
  variant: 'FilteredNodeSelect',
  id: { field: 'id' },
  // @ts-expect-error prismaNode's select takes only true for a to-one relation too
  select: { author: { where: { firstName: 'Alice' } } },
});
builder.prismaObject('Post', {
  variant: 'ToOneFunctionTypeSelect',
  // @ts-expect-error a to-one relation has no function form on a type either
  select: { author: (author) => ({ name: author }) },
});
// However the query options reach a type's select.
const limitedAuthor = { author: { limit: 1 } };
declare const disjointSelect: { author: { limit: number } } | { comments: true };
builder.prismaObject('Post', {
  variant: 'ConditionalTypeSelect',
  // @ts-expect-error one branch's to-one relation has query options
  select: flag ? { author: { limit: 1 } } : ['title'],
});
builder.prismaObject('Post', {
  variant: 'DisjointTypeSelect',
  // @ts-expect-error one member's to-one relation has query options
  select: disjointSelect,
});
builder.prismaObject('Post', {
  variant: 'EmptyOptionsTypeSelect',
  // @ts-expect-error empty options aren't `true`
  select: { author: {} },
});
builder.prismaObject('Post', {
  variant: 'VariableTypeSelect',
  // @ts-expect-error a variable holds the query options
  select: limitedAuthor,
});
builder.prismaObject('Post', {
  variant: 'SpreadTypeSelect',
  // @ts-expect-error a spread holds the query options
  select: { ...limitedAuthor, title: true },
});
// A model that is only known through a generic still takes a select.
export function genericTypeSelect<M extends 'User' | 'Post'>(model: M) {
  builder.prismaObject(model, { variant: 'GenericTypeSelect', select: ['id'] });
}
// `true` and the to-many forms stay.
builder.prismaObject('Post', {
  variant: 'TrueTypeSelect',
  select: { author: true, comments: { limit: 1 } },
  fields: (t) => ({
    name: t.string({
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<UserRow>();
        return post.author.firstName;
      },
    }),
  }),
});
builder.prismaObject('User', {
  variant: 'ToManyTypeSelects',
  select: {
    posts: { where: { published: 1 }, limit: 1 },
    comments: (sub) => ({ commentTotal: sub.count() }),
  },
});

// String-form cross-file helpers see only their own declared columns; ref forms see the type's.
builder.prismaObjectField('User', 'undeclaredObjectField', (t) =>
  // @ts-expect-error the string form's parent carries only declared dependencies
  t.string({ resolve: (user) => user.email }),
);
builder.prismaObjectFields('User', (t) => ({
  // @ts-expect-error the string form's parent carries only declared dependencies
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
  // @ts-expect-error the string form's parent carries only declared dependencies
  t.string({ resolve: (user) => user.email }),
);
builder.prismaInterfaceFields('User', (t) => ({
  declaredOnInterface: t.string({ select: ['lastName'], resolve: (user) => user.lastName }),
}));
const BareUser = builder.prismaObject('User', { variant: 'BareUser', fields: () => ({}) });
builder.prismaObjectField(BareUser, 'undeclaredViaRef', (t) =>
  // @ts-expect-error the ref's shape carries only what the object declared
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

// Prisma types route through their interface's resolveType, so they take no isTypeOf.
builder.prismaObject('Comment', {
  variant: 'CommentIsTypeOf',
  // @ts-expect-error isTypeOf is not an option of prisma types
  isTypeOf: () => true,
  fields: () => ({}),
});
builder.prismaNode('Comment', {
  variant: 'CommentNodeIsTypeOf',
  id: { field: 'id' },
  // @ts-expect-error isTypeOf is not an option of prisma types
  isTypeOf: () => true,
  fields: () => ({}),
});
// resolveType reads the interface's selected columns without a cast.
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
      // @ts-expect-error a root field returns a collection, so nested fields can add to what it loads
      resolve: () => [{ id: '1', firstName: 'a', lastName: 'b', email: 'a@b' }],
    }),
    row: t.prismaField({
      type: 'User',
      // @ts-expect-error a root field returns a collection, not a row
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
    wrongModel: t.prismaFieldWithInput({
      type: 'User',
      input: { email: t.input.string({ required: true }) },
      // @ts-expect-error `Post` rows can't resolve a `User` field
      resolve: () => sqliteClient.orm.Post,
    }),
    rightModel: t.prismaFieldWithInput({
      type: 'User',
      input: { email: t.input.string({ required: true }) },
      resolve: () => sqliteClient.orm.User,
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
// transaction) beside the execution context of the client it comes from.
type Context = { db: typeof db; tenantId: string };
declare const db: { orm: typeof orm; context: PrismaNextExecutionContext<Contract> };
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
    context: sqliteClient.context,
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
    client: (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<Context>();
      return { orm: ctx.db.orm };
    },
    context: db.context,
  },
});
new SchemaBuilder<{ PrismaNextContract: Contract; Context: Context }>({
  plugins: [prismaNextPlugin],
  // @ts-expect-error a client function needs the execution context for building the schema
  prismaNext: { client: (ctx) => ctx.db },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  // @ts-expect-error the client is required
  prismaNext: {},
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  // @ts-expect-error reported on `context`: a client object carries its own, so it's only for a function
  prismaNext: { client: db, context: db.context },
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

// Collections carry their contract (`collection.ctx.context.contract`), so a client of another
// contract fails even when its model names match.
declare const inhClient: SqliteClient<InheritanceContract>;
type OtherDbContext = { db: typeof db; otherDb: typeof inhClient };
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    // @ts-expect-error collections of another contract
    client: () => ({ orm: inhClient.orm }),
    context: sqliteClient.context,
  },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    // @ts-expect-error a collection of another contract's `User`
    client: { orm: { User: inhClient.orm.User }, context: db.context },
  },
});
new SchemaBuilder<{ PrismaNextContract: Contract; Context: OtherDbContext }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    // @ts-expect-error the request's client is of another contract
    client: (ctx) => ({ orm: ctx.otherDb.orm }),
    context: sqliteClient.context,
  },
});
new SchemaBuilder<{ PrismaNextContract: Contract; Context: { db: typeof sqliteClient } }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: (ctx) => ctx.db, context: sqliteClient.context },
});
new SchemaBuilder<{ PrismaNextContract: Contract; Context: OtherDbContext }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: (ctx) => ({ orm: ctx.db.orm }), context: sqliteClient.context },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: { orm: { User: sqliteClient.orm.User }, context: db.context } },
});
const inhBuilder = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: inhClient },
});
inhBuilder.prismaObject('Bug', {
  variant: 'FilteredVariantSelect',
  // @ts-expect-error a to-one relation in a variant type's select takes only true
  select: { owner: { limit: 1 } },
});
declare const sqliteTransaction: Parameters<Parameters<typeof sqliteClient.transaction>[0]>[0];
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: () => sqliteTransaction, context: sqliteClient.context },
});
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: () => ({ orm: sqliteTransaction.orm }), context: sqliteClient.context },
});
declare const inhTransaction: Parameters<Parameters<typeof inhClient.transaction>[0]>[0];
new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  // @ts-expect-error a transaction of another contract
  prismaNext: { client: () => inhTransaction, context: sqliteClient.context },
});

// Function-form selects with object branches, whose columns are optional on the parent.
builder.prismaObject('User', {
  fields: (t) => ({
    objectBranches: t.string({
      args: { first: t.arg.boolean() },
      select: (args) => (args.first ? { firstName: true } : { lastName: true }),
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        expectTypeOf(user.lastName).toEqualTypeOf<string | undefined>();
        return user.firstName ?? user.lastName ?? '';
      },
    }),
    spreadBranch: t.string({
      args: { first: t.arg.boolean() },
      select: (args) => ({ email: true, ...(args.first ? { firstName: true } : {}) }),
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string>();
        expectTypeOf(user.firstName).toEqualTypeOf<string | undefined>();
        return user.email;
      },
    }),
    asyncBranches: t.string({
      args: { first: t.arg.boolean() },
      select: async (args) => (args.first ? { firstName: true } : { lastName: true }),
      resolve: (user) => user.firstName ?? user.lastName ?? '',
    }),
    relationBranch: t.string({
      args: { first: t.arg.boolean() },
      select: (args) => (args.first ? { posts: true } : { email: true }),
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string | undefined>();
        return `${user.posts?.length}`;
      },
    }),
    badObjectBranch: t.string({
      args: { first: t.arg.boolean() },
      // @ts-expect-error a branch's value must still fit the spec
      select: (args) => (args.first ? { firstName: { limit: 1 } } : { lastName: true }),
      resolve: () => '',
    }),
    unknownInBranch: t.string({
      args: { first: t.arg.boolean() },
      // @ts-expect-error a branch's keys must still be columns or relations
      select: (args) => (args.first ? { nope: true } : { lastName: true }),
      resolve: () => '',
    }),
  }),
});

// A select is a column array or an object, or a function returning one.
builder.prismaObject('User', {
  fields: (t) => ({
    stringSelect: t.string({
      // @ts-expect-error a select isn't a column name
      select: 'email',
      resolve: () => '',
    }),
    numberSelect: t.string({
      // @ts-expect-error a select isn't a number
      select: 1,
      resolve: () => '',
    }),
    booleanSelect: t.string({
      // @ts-expect-error a select isn't a boolean
      select: true,
      resolve: () => '',
    }),
    stringFromFunction: t.string({
      // @ts-expect-error a select function returns an array or an object
      select: () => 'email',
      resolve: () => '',
    }),
    numberInBranch: t.string({
      args: { first: t.arg.boolean() },
      // @ts-expect-error every branch is checked
      select: (args) => (args.first ? 1 : { email: true }),
      resolve: () => '',
    }),
  }),
});
// @ts-expect-error a type's select isn't a column name
builder.prismaObject('User', { name: 'SelectString', select: 'email', fields: () => ({}) });
// @ts-expect-error a type's select isn't a number
builder.prismaObject('User', { name: 'SelectNumber', select: 1, fields: () => ({}) });
// @ts-expect-error a type's select isn't a boolean
builder.prismaObject('User', { name: 'SelectBoolean', select: true, fields: () => ({}) });
// @ts-expect-error a select isn't a column name on an interface either
builder.prismaInterface('User', { name: 'SelectIface', select: 'email', fields: () => ({}) });

// Every branch of a static conditional select is checked.
declare const flag: boolean;
builder.prismaObject('User', {
  fields: (t) => ({
    conditionalColumns: t.string({
      select: flag ? ['firstName'] : ['email'],
      resolve: () => '',
    }),
    conditionalForms: t.string({
      select: flag ? ['firstName'] : { email: true },
      resolve: () => '',
    }),
    badArrayBranch: t.string({
      // @ts-expect-error `nope` isn't a column of User
      select: flag ? ['nope'] : ['email'],
      resolve: () => '',
    }),
    badBranchBesideObject: t.string({
      // @ts-expect-error `nope` isn't a column of User
      select: flag ? ['nope'] : { email: true },
      resolve: () => '',
    }),
    badObjectBranchBesideArray: t.string({
      // @ts-expect-error `nope` isn't a column of User
      select: flag ? ['email'] : { nope: true },
      resolve: () => '',
    }),
  }),
});

// Only columns belong in a `select` array. Nothing checks these at runtime.
declare const stringsOrUndefined: (string | undefined)[];
declare const unknownValue: unknown;
builder.prismaObject('User', {
  fields: (t) => ({
    unknownColumnBesideUndefined: t.string({
      // @ts-expect-error `firstNme` isn't a column, and `undefined` isn't one either
      select: ['firstNme', undefined],
      resolve: () => '',
    }),
    undefinedEntry: t.string({
      // @ts-expect-error `undefined` isn't a column
      select: ['email', undefined],
      resolve: () => '',
    }),
    numberEntry: t.string({
      // @ts-expect-error a number isn't a column
      select: [1],
      resolve: () => '',
    }),
    objectEntry: t.string({
      // @ts-expect-error an object isn't a column
      select: [{}],
      resolve: () => '',
    }),
    booleanEntry: t.string({
      // @ts-expect-error a boolean isn't a column
      select: [true],
      resolve: () => '',
    }),
    nestedArray: t.string({
      // @ts-expect-error an array isn't a column
      select: [['email']],
      resolve: () => '',
    }),
    undefinedEntries: t.string({
      // @ts-expect-error neither `string` nor `undefined` names a column
      select: stringsOrUndefined,
      resolve: () => '',
    }),
    functionUnknownColumnBesideUndefined: t.string({
      // @ts-expect-error `firstNme` isn't a column
      select: () => ({ firstNme: true, email: undefined }),
      resolve: () => '',
    }),
    functionUndefinedEntry: t.string({
      // @ts-expect-error `undefined` isn't a column
      select: () => ({ email: true, undefined: true }),
      resolve: () => '',
    }),
    functionNumberEntry: t.string({
      // @ts-expect-error a column takes `true`, not a number
      select: () => ({ email: 1 }),
      resolve: () => '',
    }),
  }),
});
builder.prismaObject('User', {
  variant: 'TypeUnknownColumnBesideUndefined',
  // @ts-expect-error `firstNme` isn't a column, and `undefined` isn't one either
  select: ['firstNme', undefined],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'TypeUndefinedEntry',
  // @ts-expect-error `undefined` isn't a column
  select: ['email', undefined],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'TypeNumberEntry',
  // @ts-expect-error a number isn't a column
  select: [1],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'TypeObjectEntry',
  // @ts-expect-error an object isn't a column
  select: [{}],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'TypeBooleanEntry',
  // @ts-expect-error a boolean isn't a column
  select: [true],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'TypeNestedArray',
  // @ts-expect-error an array isn't a column
  select: [['email']],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'TypeUndefinedEntries',
  // @ts-expect-error neither `string` nor `undefined` names a column
  select: stringsOrUndefined,
  fields: () => ({}),
});
builder.prismaInterface('User', {
  variant: 'InterfaceUndefinedEntry',
  // @ts-expect-error `undefined` isn't a column
  select: ['email', undefined],
  fields: () => ({}),
});

// A numeric key is a key like any other, and names no column or relation.
builder.prismaObject('User', {
  fields: (t) => ({
    onlyNumericKey: t.string({
      // @ts-expect-error `0` isn't a column or relation
      select: { 0: true },
      resolve: () => '',
    }),
    numericKeyBesideColumn: t.string({
      // @ts-expect-error `1` isn't a column or relation
      select: { email: true, 1: true },
      resolve: () => '',
    }),
    numericKeyBesideRelationOption: t.string({
      // @ts-expect-error `0` isn't a relation option
      select: { posts: { 0: true, limit: 1 } },
      resolve: () => '',
    }),
  }),
});
builder.prismaObject('User', {
  variant: 'TypeOnlyNumericKey',
  // @ts-expect-error `0` isn't a column or relation
  select: { 0: true },
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'TypeNumericKeyBesideColumn',
  // @ts-expect-error `1` isn't a column or relation
  select: { email: true, 1: true },
  fields: () => ({}),
});

// A select function must return a selection, or nothing. A type's select can't be a function.
builder.prismaObject('User', {
  fields: (t) => ({
    returnsUnknown: t.string({
      // @ts-expect-error `unknown` may not be a selection
      select: () => unknownValue,
      resolve: () => '',
    }),
    resolvesToUnknown: t.string({
      // @ts-expect-error `unknown` may not be a selection
      select: async () => unknownValue,
      resolve: () => '',
    }),
    returnsFunction: t.string({
      // @ts-expect-error a select function can't return another function
      select: () => () => ['email'],
      resolve: () => '',
    }),
    returnsNull: t.string({ select: () => null, resolve: () => '' }),
    returnsUndefined: t.string({ select: () => undefined, resolve: () => '' }),
    resolvesToNull: t.string({ select: async () => null, resolve: () => '' }),
    returnsColumnsOrNull: t.string({
      select: () => (flag ? { email: true } : null),
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
  }),
});
builder.prismaObject('User', {
  variant: 'TypeFunctionSelect',
  // @ts-expect-error a type's select can't be a function
  select: () => ['email'],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'TypeFunctionBesideArray',
  // @ts-expect-error a type's select can't be a function
  select: flag ? () => ['email'] : ['firstName'],
  fields: () => ({}),
});

// Every branch of a select must pass, so none can filter a to-one relation.
builder.prismaObject('Post', {
  fields: (t) => ({
    filteredInOneBranch: t.string({
      // @ts-expect-error a to-one relation takes only `true`
      select: { author: flag ? true : { where: { firstName: 'Alice' } } },
      resolve: () => '',
    }),
    filteredInOneFunctionBranch: t.string({
      // @ts-expect-error a to-one relation takes only `true`
      select: () => (flag ? { author: true } : { author: { where: { firstName: 'Alice' } } }),
      resolve: () => '',
    }),
  }),
});
builder.prismaObject('Post', {
  variant: 'FilteredInOneBranch',
  // @ts-expect-error every branch of a type's select must pass
  select: { author: flag ? true : { where: { firstName: 'Alice' } } },
});

// An array variable may hold any of its columns, in a type's or a field's static `select`.
builder.prismaObject('User', {
  variant: 'VariableTypeSelect',
  select: someColumns,
  fields: (t) => ({
    email: t.string({
      resolve: (user) => {
        expectTypeOf(user.email).toEqualTypeOf<string | undefined>();
        return '';
      },
    }),
  }),
});

const keyed = <K extends string, V>(key: K, value: V): { [P in K]: V } =>
  ({ [key]: value }) as { [P in K]: V };

// Computed values are written onto the parent, so each key has one source and no column's name.
builder.prismaObject('Post', {
  variant: 'ComputedKeys',
  fields: (t) => ({
    duplicate: t.int({
      // @ts-expect-error `comments` and `views` both compute `n`
      select: { comments: (sub) => ({ n: sub.count() }), views: (sub) => ({ n: sub.count() }) },
      resolve: () => 0,
    }),
    // @ts-expect-error `title` is a column of Post
    column: t.int({ select: { comments: (sub) => ({ title: sub.count() }) }, resolve: () => 0 }),
    // @ts-expect-error `views` is a relation of Post
    relation: t.int({ select: { comments: (sub) => ({ views: sub.count() }) }, resolve: () => 0 }),
    branch: t.int({
      // @ts-expect-error every branch is checked
      select: () =>
        flag
          ? { comments: (sub) => ({ n: sub.count() }) }
          : { comments: (sub) => ({ id: sub.count() }) },
      resolve: () => 0,
    }),
    nonLiteral: t.int({
      args: { key: t.arg.string({ required: true }) },
      // @ts-expect-error a key built from the args can't be checked against the others
      select: (args) => ({ comments: (sub) => ({ [args.key]: sub.count() }) }),
      resolve: () => 0,
    }),
    mixed: t.int({
      args: { key: t.arg.string({ required: true }) },
      // @ts-expect-error a non-literal key beside literal ones is rejected too
      select: (args) => ({ comments: (sub) => ({ [args.key]: sub.count(), n: sub.count() }) }),
      resolve: () => 0,
    }),
    // TypeScript widens a key typed by a type parameter to `string`, so a generic helper declares
    // its result as a mapped type.
    generic: t.int({
      select: { comments: (sub) => keyed('commentTotal', sub.count()) },
      resolve: (post) => {
        expectTypeOf(post.commentTotal).toEqualTypeOf<number>();
        return post.commentTotal;
      },
    }),
    several: t.int({
      select: {
        comments: (sub) => ({ commentCount: sub.count(), firstComment: sub.limit(1) }),
        views: (sub) => ({ viewCount: sub.count() }),
      },
      resolve: (post) => post.commentCount + post.viewCount + post.firstComment.length,
    }),
  }),
});
builder.prismaObject('User', {
  variant: 'DuplicateTypeLevelComputedKeys',
  // @ts-expect-error a type's select is checked too
  select: { posts: (sub) => ({ n: sub.count() }), comments: (sub) => ({ n: sub.count() }) },
  fields: () => ({}),
});

// The plugin includes what the query selects, so a resolver's collection can't include relations.
builder.queryFields((t) => ({
  // @ts-expect-error `posts` is already included
  included: t.prismaField({ type: ['User'], resolve: () => orm.User.include('posts') }),
  includedPage: t.prismaConnection({
    type: 'User',
    // @ts-expect-error `posts` is already included
    resolve: () => orm.User.include('posts'),
  }),
}));
const userPages = prismaConnectionHelpers(builder, 'User', {});
// @ts-expect-error `posts` is already included
userPages.applyPagination(orm.User.include('posts'), {}, {});

// A whole relation to a variant with a table of its own has only that table's columns and the
// key it shares with its base. One to a variant sharing its base's table has every column.
prismaConnectionHelpers(inhBuilder, 'Note', {
  orderBy: () => ({ id: 'asc' }),
  select: () => ({ feature: true }),
  resolveNode: (note) => {
    expectTypeOf(note.feature).toBeNullable();
    expectTypeOf(note.feature!.id).toEqualTypeOf<string>();
    expectTypeOf(note.feature!.priority).toEqualTypeOf<number>();
    // @ts-expect-error `title` is a column of the base, `Task`
    note.feature?.title;
    return note;
  },
});
prismaConnectionHelpers(inhBuilder, 'User', {
  orderBy: () => ({ id: 'asc' }),
  select: () => ({ reviews: true }),
  resolveNode: (user) => {
    expectTypeOf(user.reviews[0]!.title).toEqualTypeOf<string>();
    expectTypeOf(user.reviews[0]!.severity).toEqualTypeOf<string>();
    return user;
  },
});
