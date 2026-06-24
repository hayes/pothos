/**
 * Walker behavior pinned via a recording-collection. The previous
 * iteration of this file snapshotted an intermediate
 * `PrismaNextSelection` tree; the walker now emits `.select(...) /
 * .include(rel, …)` calls inline, so each test asserts on the recorded
 * chain instead. Tests cover the same scenarios the snapshots did:
 * scalar columns, single-relation FK augmentation, sibling-alias
 * combine shape, depth-2 nested relations, and the fragment-cycle
 * defense.
 */
import {
  type DocumentNode,
  type FieldNode,
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLString,
  Kind,
  GraphQLObjectType as ObjectType,
  parse,
  type SelectionSetNode,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import { PRISMA_NEXT_MODEL, PRISMA_NEXT_RELATIONS } from '../src/constants';
import type { AnyContract } from '../src/types';
import { applySelectionToCollection } from '../src/utils/apply-selection';

/** Shape `t.exposeX` writes — column dependency on the parent row. */
function exposed(column: string): { pothosExposedField: string } {
  return { pothosExposedField: column };
}

const FIXTURE_RELATIONS: Record<
  string,
  Record<string, { isToMany: boolean; localFields: readonly string[]; targetModel: string }>
> = {
  User: {
    posts: { isToMany: true, localFields: ['id'], targetModel: 'Post' },
    bestFriend: { isToMany: false, localFields: ['bestFriendId'], targetModel: 'User' },
  },
  Post: {
    comments: { isToMany: true, localFields: ['id'], targetModel: 'Comment' },
    author: { isToMany: false, localFields: ['authorId'], targetModel: 'User' },
  },
  Comment: {
    author: { isToMany: false, localFields: ['authorId'], targetModel: 'User' },
  },
};

function modelExt(model: string): Record<string, unknown> {
  return {
    [PRISMA_NEXT_MODEL]: model,
    [PRISMA_NEXT_RELATIONS]: FIXTURE_RELATIONS[model] ?? {},
  };
}

function relationExt(spec: {
  relationName: string;
  parentModel: string;
  isToMany: boolean;
}): Record<string, unknown> {
  // Mirror what `t.relation(name)` emits now: pothosOptions.select with
  // `{ [relationName]: true }`. parentModel + isToMany are derived
  // from the parent type's PRISMA_NEXT_MODEL extension + the contract.
  return { pothosOptions: { select: { [spec.relationName]: true } } };
}

function relationCountExt(relationName: string, _parentModel: string): Record<string, unknown> {
  // Canonical function-form select shape — what users write via
  // `t.field({ select: { [rel]: sub => ({ [rel]: sub.count() }) } })`.
  return {
    pothosOptions: {
      select: {
        [relationName]: (sub: { count: () => unknown }) => ({
          [relationName]: sub.count(),
        }),
      },
    },
  };
}

// ---------------------------------------------------------------------
// Recording collection — mirrors the model in tests/apply-selection.test.ts.
// Each .include's refine callback receives a child recorder that
// captures sub-calls into the parent's `inner` slot, so we can assert
// on both top-level and nested chains.
// ---------------------------------------------------------------------

interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
  readonly inner?: readonly RecordedCall[];
}

interface RecordingCollection {
  readonly id: string;
  readonly calls: RecordedCall[];
  select: (...names: string[]) => RecordingCollection;
  include: (
    relName: string,
    refine?: (rel: RecordingCollection) => RecordingCollection,
  ) => RecordingCollection;
  where: (w: unknown) => RecordingCollection;
  orderBy: (o: unknown) => RecordingCollection;
  take: (n: number) => RecordingCollection;
  skip: (n: number) => RecordingCollection;
  count: () => unknown;
  combine: (spec: Record<string, unknown>) => RecordingCollection;
}

let recordingCounter = 0;

function createRecordingCollection(prefix = 'root'): RecordingCollection {
  const id = `${prefix}#${recordingCounter++}`;
  const calls: RecordedCall[] = [];
  const c: RecordingCollection = {
    id,
    calls,
    select(...names: string[]) {
      calls.push({ method: 'select', args: names });
      return c;
    },
    include(relName, refine) {
      const innerCalls: RecordedCall[] = [];
      if (refine) {
        const child = createRecordingChild(`${id}.include(${relName})`, innerCalls);
        refine(child);
      }
      calls.push({ method: 'include', args: [relName], inner: innerCalls });
      return c;
    },
    where(w) {
      calls.push({ method: 'where', args: [w] });
      return c;
    },
    orderBy(o) {
      calls.push({ method: 'orderBy', args: [o] });
      return c;
    },
    take(n) {
      calls.push({ method: 'take', args: [n] });
      return c;
    },
    skip(n) {
      calls.push({ method: 'skip', args: [n] });
      return c;
    },
    count() {
      calls.push({ method: 'count', args: [] });
      return { kind: 'count-marker', from: id };
    },
    combine(spec) {
      calls.push({ method: 'combine', args: [Object.keys(spec)] });
      return c;
    },
  };
  return c;
}

function createRecordingChild(prefix: string, innerCalls: RecordedCall[]): RecordingCollection {
  const id = `${prefix}#${recordingCounter++}`;
  const c: RecordingCollection = {
    id,
    calls: innerCalls,
    select(...names) {
      innerCalls.push({ method: 'select', args: names });
      return c;
    },
    include(relName, refine) {
      const grandchildCalls: RecordedCall[] = [];
      if (refine) {
        const grandchild = createRecordingChild(`${id}.include(${relName})`, grandchildCalls);
        refine(grandchild);
      }
      innerCalls.push({ method: 'include', args: [relName], inner: grandchildCalls });
      return c;
    },
    where(w) {
      innerCalls.push({ method: 'where', args: [w] });
      return c;
    },
    orderBy(o) {
      innerCalls.push({ method: 'orderBy', args: [o] });
      return c;
    },
    take(n) {
      innerCalls.push({ method: 'take', args: [n] });
      return c;
    },
    skip(n) {
      innerCalls.push({ method: 'skip', args: [n] });
      return c;
    },
    count() {
      innerCalls.push({ method: 'count', args: [] });
      return { kind: 'count-marker', from: id };
    },
    combine(spec) {
      innerCalls.push({ method: 'combine', args: [Object.keys(spec)] });
      return c;
    },
  };
  return c;
}

function buildFixtureSchema() {
  const Comment: GraphQLObjectType = new ObjectType({
    name: 'Comment',
    extensions: modelExt('Comment'),
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
      body: { type: new GraphQLNonNull(GraphQLString), extensions: exposed('body') },
      author: {
        type: User,
        extensions: relationExt({
          relationName: 'author',
          parentModel: 'Comment',
          isToMany: false,
        }),
      },
    }),
  });

  const Post: GraphQLObjectType = new ObjectType({
    name: 'Post',
    extensions: modelExt('Post'),
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
      title: { type: new GraphQLNonNull(GraphQLString), extensions: exposed('title') },
      published: { type: new GraphQLNonNull(GraphQLBoolean), extensions: exposed('published') },
      comments: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Comment))),
        extensions: relationExt({
          relationName: 'comments',
          parentModel: 'Post',
          isToMany: true,
        }),
      },
    }),
  });

  const User: GraphQLObjectType = new ObjectType({
    name: 'User',
    extensions: modelExt('User'),
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
      firstName: { type: new GraphQLNonNull(GraphQLString), extensions: exposed('firstName') },
      posts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        extensions: relationExt({
          relationName: 'posts',
          parentModel: 'User',
          isToMany: true,
        }),
      },
      drafts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        // Declarative refine — matches what `t.relation('posts', { query: { where } })`
        // compiles to. Stays on the single-consumer fast path.
        extensions: {
          pothosOptions: { select: { posts: { where: { published: 0 } } } },
        },
      },
      postCount: {
        type: new GraphQLNonNull(GraphQLInt),
        extensions: relationCountExt('posts', 'User'),
      },
    }),
  });

  const Query = new ObjectType({
    name: 'Query',
    fields: { users: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))) } },
  });

  return { schema: new GraphQLSchema({ query: Query }), User, Post, Comment };
}

const stubContract: AnyContract = {
  models: {
    User: {
      relations: {
        // The new select-option path looks up `cardinality` on the
        // contract to dispatch column vs relation. Synthetic contract
        // mirrors what the real generator emits.
        posts: { cardinality: '1:N', on: { localFields: ['id'] } },
      },
    },
    Post: {
      relations: {
        comments: { cardinality: '1:N', on: { localFields: ['id'] } },
        author: { cardinality: 'N:1', on: { localFields: ['authorId'] } },
      },
    },
    Comment: {
      relations: {
        author: { cardinality: 'N:1', on: { localFields: ['authorId'] } },
      },
    },
  },
} as unknown as AnyContract;

function selectionSetFromQuery(query: string): SelectionSetNode {
  const doc: DocumentNode = parse(query);
  const op = doc.definitions[0];
  if (op?.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error('Expected operation definition');
  }
  const usersField = op.selectionSet.selections[0] as FieldNode;
  if (!usersField.selectionSet) {
    throw new Error('Expected selection set');
  }
  return usersField.selectionSet;
}

function buildResolveInfo(
  rootType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  schema: GraphQLSchema,
): GraphQLResolveInfo {
  const fakeFieldNode: FieldNode = {
    kind: Kind.FIELD,
    name: { kind: Kind.NAME, value: 'users' },
    selectionSet,
  };
  return {
    returnType: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(rootType))),
    fieldNodes: [fakeFieldNode],
    parentType: rootType,
    fieldName: 'users',
    schema,
    fragments: {},
    rootValue: undefined,
    operation: undefined,
    variableValues: {},
    path: { prev: undefined, key: 'users', typename: undefined },
  } as unknown as GraphQLResolveInfo;
}

describe('walker · chain emission', () => {
  it('emits a .select with scalar columns and no includes', () => {
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { id firstName } }');
    const info = buildResolveInfo(User, sel, schema);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, stubContract, {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    expect(selectCall).toBeDefined();
    expect([...(selectCall?.args ?? [])].sort()).toEqual(['firstName', 'id']);
    expect(base.calls.find((c) => c.method === 'include')).toBeUndefined();
  });

  it('augments parent SELECT with relation localFields when including a single relation', () => {
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { firstName posts { id title } } }');
    const info = buildResolveInfo(User, sel, schema);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, stubContract, {});

    // Parent columns include `id` (the FK localField for `posts`) even
    // though the user only asked for `firstName`. Single-consumer fast
    // path: a single .include(posts, refineFn) with no combine.
    const selectCall = base.calls.find((c) => c.method === 'select');
    expect([...(selectCall?.args ?? [])].sort()).toEqual(['firstName', 'id']);

    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    expect(includes[0]?.args).toEqual(['posts']);
    const innerSelect = includes[0]?.inner?.find((c) => c.method === 'select');
    expect([...(innerSelect?.args ?? [])].sort()).toEqual(['id', 'title']);
    expect(includes[0]?.inner?.find((c) => c.method === 'combine')).toBeUndefined();
  });

  it('sibling-aliased branches on the same relation collapse into a combine block', () => {
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { posts { id } drafts { id } postCount } }');
    const info = buildResolveInfo(User, sel, schema);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, stubContract, {});

    const includes = base.calls.filter((c) => c.method === 'include');
    // All three target the `posts` relation: posts (alias=posts),
    // drafts (refined), postCount (function-form). They collapse to a
    // single .include(posts, ...) with a combine spec keyed by
    // `<fieldAlias>:<specKey>`.
    expect(includes).toHaveLength(1);
    expect(includes[0]?.args).toEqual(['posts']);
    const combineCall = includes[0]?.inner?.find((c) => c.method === 'combine');
    expect(combineCall).toBeDefined();
    expect([...((combineCall?.args[0] as string[]) ?? [])].sort()).toEqual([
      'drafts:posts',
      'postCount:posts',
      'posts:posts',
    ]);
    // The count() must have been invoked on the relation collection
    // before being placed in the combine spec.
    const countCall = includes[0]?.inner?.find((c) => c.method === 'count');
    expect(countCall).toBeDefined();
  });

  it('descends into nested relations (depth ≥ 2)', () => {
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { posts { title comments { id body } } } }');
    const info = buildResolveInfo(User, sel, schema);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, stubContract, {});

    // User → posts include → Post select + comments include → Comment select.
    // FK augmentation fires at each level (User.id, Post.id).
    const userSelect = base.calls.find((c) => c.method === 'select');
    expect([...(userSelect?.args ?? [])].sort()).toEqual(['id']);

    const userIncludes = base.calls.filter((c) => c.method === 'include');
    expect(userIncludes).toHaveLength(1);
    expect(userIncludes[0]?.args).toEqual(['posts']);

    const postsInner = userIncludes[0]?.inner ?? [];
    const postsSelect = postsInner.find((c) => c.method === 'select');
    // Post's parent SELECT picks up `id` (FK for comments) + `title`.
    expect([...(postsSelect?.args ?? [])].sort()).toEqual(['id', 'title']);

    const commentsInclude = postsInner.find(
      (c) => c.method === 'include' && c.args[0] === 'comments',
    );
    expect(commentsInclude).toBeDefined();
    const commentsSelect = commentsInclude?.inner?.find((c) => c.method === 'select');
    expect([...(commentsSelect?.args ?? [])].sort()).toEqual(['body', 'id']);
  });

  // Fragment cycle handling intentionally delegated to GraphQL.js's
  // NoFragmentCycles validation rule. The walker assumes validated
  // operations and does not guard against cyclic fragments.
});
