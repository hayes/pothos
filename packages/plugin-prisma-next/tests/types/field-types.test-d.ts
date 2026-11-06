import SchemaBuilder, {
  type FieldNullability,
  type FieldRef,
  type InputFieldMap,
  type SchemaTypes,
  type TypeParam,
} from '@pothos/core';
import RelayPlugin, { type ConnectionShape } from '@pothos/plugin-relay';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, {
  type CollectionFor,
  type PrismaNextInterfaceRef,
  type PrismaNextNodeRef,
  type PrismaNextObjectFieldBuilder,
  type PrismaNextObjectRef,
  prismaConnectionHelpers,
  type Row,
} from '../../src';
import type { ExposableColumn } from '../../src/types/fields';
import type { ObjectBaseShape } from '../../src/types/models';
import type {
  PrismaNextFieldSelect,
  SelectColumnCheck,
  ValidateFieldSelect,
} from '../../src/types/selections';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;
type UserRow = DefaultModelRow<Contract, 'User'>;
type PostRow = DefaultModelRow<Contract, 'Post'>;

declare global {
  export namespace PothosSchemaTypes {
    export interface QueryFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > {
      /** Added by another plugin. It exists only on query fields. */
      testQueryOption?: boolean;
    }
  }
}

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
declare const orm: { User: CollectionFor<Types, 'User'>; Post: CollectionFor<Types, 'Post'> };

const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  fields: (t) => ({ id: t.exposeID('id') }),
});
// `variant` names a type that shares its model, so it can't be set beside `name`.
// @ts-expect-error only one of `name` and `variant`
builder.prismaObject('User', { name: 'A', variant: 'B', fields: () => ({}) });
// @ts-expect-error only one of `name` and `variant`
builder.prismaInterface('User', { name: 'A', variant: 'B', fields: () => ({}) });
// @ts-expect-error only one of `name` and `variant`
builder.prismaNode('User', {
  name: 'A',
  variant: 'B',
  id: { field: 'id' },
  fields: () => ({}),
});

// t.variant takes the options of any object field, and its shape says when it can be null.
builder.prismaObject('User', {
  fields: (t) => {
    const plain = t.variant(Viewer, {
      description: 'the viewer',
      deprecationReason: 'use me',
      extensions: { custom: true },
      args: { flag: t.arg.boolean() },
    });
    const byName = t.variant('User');
    const nullable = t.variant(Viewer, { nullable: true });
    const conditional = t.variant(Viewer, {
      select: ['firstName'],
      isNull: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        // @ts-expect-error only the columns `select` lists are on the parent
        return user.lastName === '';
      },
    });
    const asyncNull = t.variant(Viewer, { isNull: async () => false });
    const explicit = t.variant(Viewer, { nullable: true, isNull: () => false });

    expectTypeOf(plain).toEqualTypeOf<FieldRef<Types, UserRow, 'PrismaNextObject'>>();
    expectTypeOf(byName).toEqualTypeOf<FieldRef<Types, UserRow, 'PrismaNextObject'>>();
    expectTypeOf(nullable).toEqualTypeOf<FieldRef<Types, UserRow | null, 'PrismaNextObject'>>();
    expectTypeOf(conditional).toEqualTypeOf<FieldRef<Types, UserRow | null, 'PrismaNextObject'>>();
    expectTypeOf(asyncNull).toEqualTypeOf<FieldRef<Types, UserRow | null, 'PrismaNextObject'>>();
    expectTypeOf(explicit).toEqualTypeOf<FieldRef<Types, UserRow | null, 'PrismaNextObject'>>();

    return {
      plain,
      byName,
      nullable,
      conditional,
      asyncNull,
      explicit,
      // @ts-expect-error `isNull` can resolve to null, so the field can't be `nullable: false`
      strict: t.variant(Viewer, { nullable: false, isNull: () => false }),
      // @ts-expect-error unknown options are still rejected
      unknown: t.variant(Viewer, { nope: true }),
      // @ts-expect-error `select` lists columns
      badSelect: t.variant(Viewer, { select: ['nope'] }),
      // `select` also takes the object form, and isNull's parent has what it selects.
      objectSelect: t.variant(Viewer, {
        select: { email: true },
        isNull: (user) => {
          expectTypeOf(user.email).toEqualTypeOf<string>();
          return false;
        },
      }),
      // @ts-expect-error the object form lists columns
      badObjectSelect: t.variant(Viewer, { select: { nope: true } }),
      // @ts-expect-error t.variant installs its own resolver
      resolver: t.variant(Viewer, { resolve: () => null }),
      // @ts-expect-error a variant of another model
      otherModel: t.variant('Post'),
    };
  },
});

// Relation `orderBy` returns the ORM's ordering, like a connection's.
builder.prismaObject('Post', {
  variant: 'PostOrdering',
  fields: (t) => ({
    comments: t.relation('comments', {
      query: { orderBy: (comment) => comment.id.desc() },
    }),
    severalOrders: t.relation('comments', {
      query: { orderBy: [(comment) => comment.id.desc(), (comment) => comment.postId.asc()] },
    }),
    // @ts-expect-error an ordering is an OrderByItem, not a number
    numeric: t.relation('comments', { query: { orderBy: () => 5 } }),
    // @ts-expect-error an ordering is an OrderByItem, not an accessor
    accessor: t.relation('comments', { query: { orderBy: (comment) => comment.id } }),
    selected: t.string({
      select: { comments: { orderBy: (comment) => comment.id.asc(), limit: 1 } },
      resolve: (post) => post.comments[0]?.id ?? '',
    }),
    badSelected: t.string({
      // @ts-expect-error a select's relation ordering is an OrderByItem too
      select: { comments: { orderBy: () => 'id' } },
      resolve: () => '',
    }),
  }),
});

// The FieldRefs relation and connection fields return carry the rows they load.
builder.prismaObject('Post', {
  variant: 'PostRefs',
  fields: (t) => {
    const author = t.relation('author');
    const comments = t.relation('comments');
    // Connections take the builder's default field nullability, nullable here.
    const page = t.relatedConnection('comments', { nullable: false });
    const nullablePage = t.relatedConnection('comments', {});
    expectTypeOf(author).toEqualTypeOf<FieldRef<Types, UserRow, 'PrismaNextObject'>>();
    expectTypeOf(comments).toEqualTypeOf<
      FieldRef<Types, readonly Row<Types, 'Comment'>[], 'PrismaNextObject'>
    >();
    expectTypeOf(page).toEqualTypeOf<
      FieldRef<Types, ConnectionShape<Types, Row<Types, 'Comment'>, false>, 'PrismaNextObject'>
    >();
    expectTypeOf(nullablePage).toEqualTypeOf<
      FieldRef<Types, ConnectionShape<Types, Row<Types, 'Comment'>, true>, 'PrismaNextObject'>
    >();
    return { author, comments, page, nullablePage };
  },
});

builder.queryFields((t) => {
  const posts = t.prismaConnection({
    type: 'Post',
    nullable: false,
    resolve: () => orm.Post,
  });
  const nullablePosts = t.prismaConnection({ type: 'Post', resolve: () => orm.Post });
  expectTypeOf(posts).toEqualTypeOf<FieldRef<Types, ConnectionShape<Types, PostRow, false>>>();
  expectTypeOf(nullablePosts).toEqualTypeOf<
    FieldRef<Types, ConnectionShape<Types, PostRow, true>>
  >();
  return { posts, nullablePosts };
});

// prismaConnectionHelpers takes a ref (a named type or a variant) as well as a model name.
{
  const byName = prismaConnectionHelpers(builder, 'User', {});
  expectTypeOf(byName.ref).toEqualTypeOf<PrismaNextObjectRef<Types, 'User', Row<Types, 'User'>>>();
  const byRef = prismaConnectionHelpers(builder, Viewer, {
    orderBy: { email: 'asc' },
    resolveNode: (user) => {
      // Without a relation given `nodeSelection()`, nothing is planned into the rows: they are whole.
      expectTypeOf(user).toEqualTypeOf<UserRow>();
      return user;
    },
  });
  expectTypeOf(byRef.ref).toEqualTypeOf(Viewer);
  // @ts-expect-error the order names a column of the ref's model
  prismaConnectionHelpers(builder, Viewer, { orderBy: { title: 'asc' } });
  // @ts-expect-error a ref's model takes that model's collection
  byRef.applyPagination(orm.Post, {}, {});

  const inheritance = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client: null as never },
  });
  const Bug = inheritance.prismaObject('Bug', { fields: (t) => ({ id: t.exposeID('id') }) });
  const bugs = prismaConnectionHelpers(inheritance, Bug, { orderBy: { severity: 'asc' } });
  expectTypeOf(bugs.ref).toEqualTypeOf(Bug);
}

// Completions: the editor's placeholder while completing a `select` entry gets the column names,
// never a message string.
expectTypeOf<SelectColumnCheck<Types, 'User', string>>().toEqualTypeOf<
  'id' | 'firstName' | 'lastName' | 'email'
>();
// A field's array takes any string, so an array of only unknown columns reaches the check, which
// names them, instead of failing as `'frstName'` not assignable to `never`.
type UserShape = ObjectBaseShape<Types, 'User'>;
expectTypeOf<readonly ['frstName']>().toExtend<PrismaNextFieldSelect<Types, UserShape, {}>>();
expectTypeOf<ValidateFieldSelect<Types, UserShape, readonly ['frstName']>>().toEqualTypeOf<
  readonly [{ readonly 'Unknown column in select': 'frstName' }]
>();
builder.prismaObject('User', {
  variant: 'ArraySelectTypo',
  // @ts-expect-error `emial` isn't a column
  select: ['email', 'emial'],
  fields: (t) => ({
    typo: t.string({
      // @ts-expect-error `frstName` isn't a column
      select: ['firstName', 'frstName'],
      resolve: () => '',
    }),
    onlyTypos: t.string({
      // @ts-expect-error `frstName` isn't a column, with no valid column beside it
      select: ['frstName'],
      resolve: () => '',
    }),
    // @ts-expect-error User has no Int column
    noInt: t.exposeInt('email'),
    // @ts-expect-error `email` isn't a Boolean
    wrongType: t.exposeBoolean('email'),
  }),
});
// Completions for `t.exposeString`.
expectTypeOf<ExposableColumn<Types, UserRow, 'String', true>>().toEqualTypeOf<
  'id' | 'firstName' | 'lastName' | 'email'
>();

// The field builder's `in out` annotations (Types, M, ExposableShape) don't change what it is
// assignable to: helpers typed with the default, `any` or a wider `Shape` still take `t`.
type UserFieldBuilder<Shape = unknown, Exposable = UserRow> = PrismaNextObjectFieldBuilder<
  Types,
  'User',
  Shape,
  Exposable
>;
const idOf = (t: UserFieldBuilder) => t.exposeID('id');
// biome-ignore lint/suspicious/noExplicitAny: helpers are commonly typed with an `any` shape
const idOfAny = (t: UserFieldBuilder<any>) => t.exposeID('id');
// biome-ignore lint/suspicious/noExplicitAny: helpers are commonly typed with an `any` shape
const idOfAnyRow = (t: UserFieldBuilder<unknown, any>) => t.exposeID('id');
const idOfWide = (t: UserFieldBuilder<{ id: string }>) => t.exposeID('id');
builder.prismaObject('User', {
  variant: 'FieldHelpers',
  fields: (t) => ({ a: idOf(t), b: idOfAny(t), c: idOfAnyRow(t), d: idOfWide(t) }),
});
builder.prismaObject('User', {
  variant: 'SelectFieldHelpers',
  select: ['firstName'],
  fields: (t) => ({ a: idOf(t), b: idOfAny(t), c: idOfAnyRow(t), d: idOfWide(t) }),
});
builder.prismaObjectFields('User', (t) => ({ a: idOf(t), b: idOfWide(t) }));
builder.prismaObject('Post', {
  variant: 'OtherModelHelper',
  // @ts-expect-error a User helper doesn't take a Post builder
  fields: (t) => ({ a: idOf(t) }),
});

// Builder to builder: Shape and ExposableShape compare structurally. M widens (a User builder is a
// User | Post builder) but doesn't narrow, and Types must match.
type Narrow = { a: 1; b: 2 };
type Wide = { a: 1 };
declare const narrowShape: UserFieldBuilder<Narrow, Narrow>;
declare const wideShape: UserFieldBuilder<Wide, Narrow>;
declare const wideExposable: UserFieldBuilder<Narrow, Wide>;
declare const twoModels: PrismaNextObjectFieldBuilder<Types, 'User' | 'Post', Narrow, Narrow>;
declare const otherTypes: PrismaNextObjectFieldBuilder<
  Types & { Extra: 1 },
  'User',
  Narrow,
  Narrow
>;
export const shapeWidens: UserFieldBuilder<Wide, Narrow> = narrowShape;
// @ts-expect-error a builder for a wider shape isn't one for a narrower shape
export const shapeNarrows: UserFieldBuilder<Narrow, Narrow> = wideShape;
export const exposableWidens: UserFieldBuilder<Narrow, Wide> = narrowShape;
export const exposableNarrows: UserFieldBuilder<Narrow, Narrow> = wideExposable;
export const modelWidens: PrismaNextObjectFieldBuilder<Types, 'User' | 'Post', Narrow, Narrow> =
  narrowShape;
// @ts-expect-error a builder for several models isn't one for a single model
export const modelNarrows: UserFieldBuilder<Narrow, Narrow> = twoModels;
// @ts-expect-error the schema types must match
export const typesDiffer: UserFieldBuilder<Narrow, Narrow> = otherTypes;

// A root field's `type` takes refs of this builder's contract, not refs of another builder's.
{
  const other = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client: null as never },
  });
  const OtherUser = other.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
  const OtherIface = other.prismaInterface('User', {
    fields: (t) => ({ id: t.exposeID('id') }),
  });
  const OwnUser = builder.prismaObject('User', {
    variant: 'RootRefUser',
    fields: (t) => ({ id: t.exposeID('id') }),
  });
  const OwnPost = builder.prismaInterface('Post', {
    name: 'RootRefPost',
    fields: (t) => ({ id: t.exposeID('id') }),
  });
  const OwnNode = builder.prismaNode('User', {
    variant: 'RootRefNode',
    id: { field: 'id' },
    fields: (t) => ({ email: t.exposeString('email') }),
  });
  builder.queryFields((t) => ({
    ownUser: t.prismaField({ type: OwnUser, nullable: true, resolve: () => null }),
    ownUsers: t.prismaField({ type: [OwnUser], resolve: () => orm.User }),
    ownPosts: t.prismaField({ type: [OwnPost], resolve: () => orm.Post }),
    ownNodes: t.prismaField({ type: [OwnNode], resolve: () => orm.User }),
    ownPostConnection: t.prismaConnection({
      type: OwnPost,
      resolve: () => orm.Post,
    }),
    // @ts-expect-error a ref of another builder's contract
    otherUser: t.prismaField({ type: OtherUser, nullable: true, resolve: () => null }),
    // @ts-expect-error a list of another builder's refs
    otherUsers: t.prismaField({ type: [OtherUser], resolve: () => orm.User }),
    // @ts-expect-error an interface ref of another builder's contract
    otherConn: t.prismaConnection({ type: OtherIface, resolve: () => orm.User }),
  }));
}

// Root fields take the options of the kind of field they are.
declare const newUserIds: AsyncIterable<string>;
builder.subscriptionField('newUser', (t) =>
  t.prismaField({
    type: 'User',
    nullable: true,
    subscribe: () => newUserIds,
    resolve: (id) => {
      expectTypeOf(id).toEqualTypeOf<string>();
      return orm.User.where({ id });
    },
  }),
);
builder.subscriptionField('noSubscribe', (t) =>
  // @ts-expect-error a subscription field needs `subscribe`
  t.prismaField({ type: 'User', resolve: () => orm.User }),
);
builder.queryField('queryOption', (t) =>
  t.prismaField({ type: 'User', testQueryOption: true, resolve: () => orm.User }),
);
builder.queryField('queryConnectionOption', (t) =>
  t.prismaConnection({
    type: 'User',
    testQueryOption: true,
    resolve: () => orm.User,
  }),
);
builder.mutationField('mutationOption', (t) =>
  // @ts-expect-error only query fields have this option
  t.prismaField({ type: 'User', testQueryOption: true, resolve: () => orm.User }),
);
builder.mutationField('mutationConnectionOption', (t) =>
  t.prismaConnection({
    type: 'User',
    // @ts-expect-error only query fields have this option
    testQueryOption: true,
    resolve: () => orm.User,
  }),
);
builder.queryField('rootParent', (t) =>
  t.prismaField({
    type: 'User',
    resolve: (parent) => {
      expectTypeOf(parent).toEqualTypeOf<{}>();
      return orm.User;
    },
  }),
);

// A prisma type's root-style fields read the parent their `select` loads.
builder.prismaObject('User', {
  variant: 'RootFieldsWithSelect',
  fields: (t) => ({
    related: t.prismaField({
      type: 'Post',
      select: ['firstName'],
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        // @ts-expect-error not in the select
        return orm.Post.where({ title: user.lastName });
      },
    }),
    relatedList: t.prismaField({
      type: ['Post'],
      select: { email: true },
      resolve: (user) => orm.Post.where({ title: user.email }),
    }),
    page: t.prismaConnection({
      type: 'Post',
      select: ['firstName'],
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        return orm.Post.where({ title: user.firstName });
      },
    }),
    noSelect: t.prismaField({
      type: 'Post',
      resolve: (user) => {
        expectTypeOf(user.id).toEqualTypeOf<string>();
        // @ts-expect-error only the key without a select
        return orm.Post.where({ title: user.firstName });
      },
    }),
  }),
});

// A subscription connection's `resolve` reads what `subscribe` yields.
declare const pageRequests: AsyncIterable<{ authorId: string }>;
builder.subscriptionField('postPage', (t) =>
  t.prismaConnection({
    type: 'Post',
    subscribe: () => pageRequests,
    resolve: (request) => {
      expectTypeOf(request).toEqualTypeOf<{ authorId: string }>();
      return orm.Post.where({ authorId: request.authorId });
    },
  }),
);

// A ref annotated without a shape accepts the refs prismaObject returns, and its fields' `select`
// still types the parent.
{
  const PostWithTitle = builder.prismaObject('Post', {
    variant: 'PostWithTitle',
    select: { title: true },
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  function addTitleLength(ref: PrismaNextObjectRef<Types, 'Post'>) {
    builder.prismaObjectField(ref, 'titleLength', (t) =>
      t.int({ select: { title: true }, resolve: (post) => post.title.length }),
    );
  }
  addTitleLength(PostWithTitle);
  // @ts-expect-error a User ref isn't a Post ref
  addTitleLength(Viewer);

  const takeInterface = (_ref: PrismaNextInterfaceRef<Types, 'Post'>) => {};
  takeInterface(
    builder.prismaInterface('Post', {
      variant: 'PostWithTitleInterface',
      select: { title: true },
      fields: () => ({}),
    }),
  );
  const takeNode = (_ref: PrismaNextNodeRef<Types, 'Post'>) => {};
  takeNode(
    builder.prismaNode('Post', {
      variant: 'PostWithTitleNode',
      id: { field: 'id' },
      select: { title: true },
      fields: () => ({}),
    }),
  );
}

// Without `args`, a root field's args have no keys.
builder.queryFields((t) => ({
  noArgsPost: t.prismaField({
    type: 'Post',
    resolve: (_root, args) => {
      // @ts-expect-error no such arg
      args.typo;
      return orm.Post;
    },
  }),
  noArgsPosts: t.prismaConnection({
    type: 'Post',
    resolve: (_root, args) => {
      // @ts-expect-error no such arg
      args.typo;
      return orm.Post;
    },
  }),
}));
