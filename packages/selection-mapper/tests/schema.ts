import type { GraphQLField } from 'graphql';
import type { IndirectInclude, SelectFn, WalkedType } from '../src';
import { createModels, createSchema, FakeAdapter, type FakeMap } from './fake-adapter';

export const models = createModels('User', 'Post', 'Comment', 'Profile');

models.User.relations = { posts: models.Post, profile: models.Profile };
models.Post.relations = { author: models.User, comments: models.Comment };
models.Comment.relations = { author: models.User };

type Select = SelectFn<FakeMap>;

type Args = Record<string, unknown>;

/** `t.relation`-style: the nested selection under the relation, with a query built from args. */
const relationSelect =
  (name: string, query?: (args: Args) => FakeMap): Select =>
  (args, _ctx, nested) => ({ select: { [name]: nested(query?.(args as Args) ?? {}) } });

const takeQuery = (args: Args): FakeMap => (args.take === undefined ? {} : { take: args.take });
const whereXQuery = (args: Args): FakeMap => (args.x === undefined ? {} : { where: { x: args.x } });

/** `t.relatedConnection`-style: nodes and edges.node planned for the target model. */
const connectionSelect =
  (name: string, target: string): Select =>
  (args, _ctx, nested, selectedFieldNode) => {
    const include: IndirectInclude = {
      getType: () => target,
      paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
    };
    const { first } = args as { first?: number };

    return {
      select: { [name]: nested(first === undefined ? {} : { take: first }, include) },
      ...(selectedFieldNode(['totalCount']) ? { extras: { [`${name}Count`]: true } } : {}),
    };
  };

export const sdl = /* GraphQL */ `
  directive @defer(if: Boolean = true, label: String) on FRAGMENT_SPREAD | INLINE_FRAGMENT

  type Query {
    user: User
    viewer: Viewer
    person: Person
    entries: [Entry]
    result: UserResult
  }

  interface Node { id: ID }
  interface Named { name: String }
  interface Person implements Node { id: ID, posts(take: Int): [Post] }

  type User implements Node & Named & Person {
    id: ID
    name: String
    posts(take: Int): [Post]
    profile: Profile
    postsConnection(first: Int): PostConnection
  }

  type Viewer implements Node & Person {
    id: ID
    email: String
    posts(take: Int): [Post]
    profile: Profile
  }

  type Admin implements Node & Person {
    id: ID
    posts(take: Int): [Post]
  }

  type Post { id: ID, title: String, author(x: Int): User, comments: [Comment] }
  type Comment { id: ID, author: User }
  type Profile { bio: String }

  type PostConnection { totalCount: Int, nodes: [Post], edges: [PostEdge], pageInfo: PageInfo }
  type PostEdge { cursor: String, node: Post }
  type PageInfo { hasNextPage: Boolean }

  interface Entry { kind: String }
  type AppointmentEntry implements Entry { kind: String, appointment: User }
  type VariantEntry implements Entry { kind: String, appointment: Viewer }
  type AdminEntry implements Entry { kind: String, appointment: Admin }
  type OtherEntry implements Entry { kind: String, appointment: Post }

  union UserResult = UserSuccess | Failure
  type UserSuccess { data: User }
  type Failure { message: String }
`;

export const userResultInclude: IndirectInclude = {
  getType: () => 'User',
  path: [{ type: 'UserSuccess', name: 'data' }],
};

export function createTestSchema() {
  return createSchema(sdl, {
    // Include mode: no type-level select means every column.
    User: {
      model: 'User',
      fields: {
        posts: relationSelect('posts', takeQuery),
        profile: relationSelect('profile'),
        postsConnection: connectionSelect('posts', 'Post'),
      },
    },
    // Select mode, with a type-level relation carrying arguments.
    Viewer: {
      model: 'User',
      select: { select: { id: true, posts: { take: 5 } } },
      fields: {
        email: { select: { email: true } },
        posts: relationSelect('posts', takeQuery),
        profile: relationSelect('profile'),
      },
    },
    // A variant whose type-level selection conflicts with Viewer's.
    Admin: {
      model: 'User',
      select: { select: { posts: { take: 1 } } },
      fields: { posts: relationSelect('posts', takeQuery) },
    },
    Person: {
      model: 'User',
      select: { select: { id: true } },
      fields: { posts: relationSelect('posts', takeQuery) },
    },
    Post: {
      model: 'Post',
      fields: {
        author: relationSelect('author', whereXQuery),
        comments: relationSelect('comments'),
      },
    },
    Comment: { model: 'Comment', fields: { author: relationSelect('author') } },
    Profile: { model: 'Profile' },
    UserResult: { extensions: { pothosIndirectInclude: userResultInclude } },
  });
}

export function createTestAdapter() {
  return new FakeAdapter(models);
}

export type Wrap = (select: Select, field: string) => Select;

/**
 * The test adapter with the select functions of the named fields wrapped (S-6): a subclass, so
 * the prototype the walker calls through is the one the wrapping is on.
 */
class WrappedAdapter extends FakeAdapter {
  constructor(
    private readonly fields: string[],
    private readonly wrap: Wrap,
  ) {
    super(models);
  }

  override fieldSelection(field: GraphQLField<unknown, unknown>, type: WalkedType) {
    const selection = super.fieldSelection(field, type);

    return typeof selection === 'function' && this.fields.includes(field.name)
      ? this.wrap(selection as Select, field.name)
      : selection;
  }
}

export function withSelects(fields: string[], wrap: Wrap): FakeAdapter {
  return new WrappedAdapter(fields, wrap);
}

export function withWraps(wraps: Record<string, Wrap>): FakeAdapter {
  return withSelects(Object.keys(wraps), (select, name) => wraps[name](select, name));
}
