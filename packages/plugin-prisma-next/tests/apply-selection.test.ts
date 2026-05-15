import {
  DirectiveLocation,
  type DocumentNode,
  type FieldNode,
  GraphQLBoolean,
  GraphQLDirective,
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

/**
 * `t.exposeX(name)` in production sets Pothos core's `pothosExposedField`
 * extension on the field config to the column name. The fixture mirrors
 * that: every plain scalar field gets the extension so the mapper maps
 * the GraphQL field back to its parent-row column. Same shape Pothos's
 * built-in `exposeField` produces (`@pothos/core` `fieldUtils/base.ts`).
 */
function exposed(column: string): { pothosExposedField: string } {
  return { pothosExposedField: column };
}

/**
 * Build the type-level extensions a real prismaObject would carry —
 * `PRISMA_NEXT_MODEL` + `PRISMA_NEXT_RELATIONS` precomputed metadata.
 * The walker reads relations from the type extension; ad-hoc fixture
 * types must supply both keys.
 */
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

interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
  /** Inner mapper calls captured when this was an `.include(name, refineFn)`. */
  readonly inner?: readonly RecordedCall[];
  /** Inner branch calls captured when this was a `.combine({...})`. */
  readonly combineBranches?: Readonly<Record<string, readonly RecordedCall[]>>;
}

interface RecordingCollection {
  readonly id: string;
  readonly calls: RecordedCall[];
  // Methods the mapper uses; each returns a child RecordingCollection.
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
      const branches: Record<string, readonly RecordedCall[]> = {};
      for (const key of Object.keys(spec)) {
        branches[key] = [];
      }
      calls.push({ method: 'combine', args: [Object.keys(spec)], combineBranches: branches });
      return c;
    },
  };
  return c;
}

/**
 * Wrap createRecordingCollection so calls to the *child* (the rel passed
 * to refine) push into the provided innerCalls array. Each refine
 * invocation gets a fresh child collection that records into its own
 * include's `inner` slot.
 */
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
      const branches: Record<string, readonly RecordedCall[]> = {};
      for (const key of Object.keys(spec)) {
        branches[key] = [];
      }
      innerCalls.push({
        method: 'combine',
        args: [Object.keys(spec)],
        combineBranches: branches,
      });
      return c;
    },
  };
  return c;
}

interface RelationExtSpec {
  relationName: string;
  parentModel: string;
  isToMany: boolean;
  // Declarative refine: literal `where` (object or model-accessor
  // callback). Mirrors what the user-facing `query` option compiles to.
  where?: unknown | ((accessor: unknown) => unknown);
}

function relationExt(spec: RelationExtSpec): Record<string, unknown> {
  // Mirror what `t.relation(name, { query })` emits internally now:
  //   - no refine: `{ [name]: true }` (simple include)
  //   - with refine: `{ [name]: { where: literal } }` (declarative
  //     refine — single-consumer fast path).
  const selectSpec: Record<string, unknown> = spec.where
    ? { [spec.relationName]: { where: spec.where } }
    : { [spec.relationName]: true };
  return { pothosOptions: { select: selectSpec } };
}

function relationCountExt(relationName: string, _parentModel: string): Record<string, unknown> {
  // Canonical function-form select shape: `t.field({ select: { [rel]:
  // sub => ({ [rel]: sub.count() }) }, resolve: parent => parent[rel] })`.
  // whose value is `sub.count()`. Inner key uses the relation name so
  // the per-field overlay drops the count onto parent[relationName].
  return {
    pothosOptions: {
      select: {
        [relationName]: (sub: unknown) => {
          const s = sub as RecordingCollection;
          return { [relationName]: s.count() };
        },
      },
    },
  };
}

/**
 * Demo schema fixture: User has a `posts` relation (1:N → Post) and a
 * `bestFriend` relation (1:1 → User self-reference). Post has `comments`
 * (1:N → Comment) and `author` (N:1 → User).
 */
function buildFixtureSchema(): {
  schema: GraphQLSchema;
  User: GraphQLObjectType;
  Post: GraphQLObjectType;
  Comment: GraphQLObjectType;
} {
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
      lastName: { type: new GraphQLNonNull(GraphQLString), extensions: exposed('lastName') },
      // Plain include, alias === relationName.
      posts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        extensions: relationExt({
          relationName: 'posts',
          parentModel: 'User',

          isToMany: true,
        }),
      },
      // Sibling-aliased: backs the same `posts` relation with a static where.
      drafts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        extensions: relationExt({
          relationName: 'posts',
          parentModel: 'User',
          isToMany: true,
          where: { published: 0 },
        }),
      },
      publishedPosts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        extensions: relationExt({
          relationName: 'posts',
          parentModel: 'User',
          isToMany: true,
          where: { published: 1 },
        }),
      },
      // Peer count.
      postCount: {
        type: new GraphQLNonNull(GraphQLInt),
        extensions: relationCountExt('posts', 'User'),
      },
      // To-one self-reference (1:1 cardinality).
      bestFriend: {
        type: User,
        extensions: relationExt({
          relationName: 'bestFriend',
          parentModel: 'User',
          isToMany: false,
        }),
      },
    }),
  });

  const Query = new ObjectType({
    name: 'Query',
    fields: { users: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))) } },
  });

  const deferDirective = new GraphQLDirective({
    name: 'defer',
    locations: [DirectiveLocation.FRAGMENT_SPREAD, DirectiveLocation.INLINE_FRAGMENT],
    args: { if: { type: GraphQLBoolean }, label: { type: GraphQLString } },
  });
  return {
    schema: new GraphQLSchema({ query: Query, directives: [deferDirective] }),
    User,
    Post,
    Comment,
  };
}

/**
 * Build a stub Contract that exposes the relation metadata the mapper needs to
 * read for the W-1 (FK columns) workaround. The relation metadata
 * matches the fixture schema above.
 */
function buildStubContract(): AnyContract {
  return {
    models: {
      User: {
        relations: {
          posts: { cardinality: '1:N', on: { localFields: ['id'] } },
          bestFriend: { cardinality: '1:1', on: { localFields: ['bestFriendId'] } },
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
}

/** Parse `query { users { ... } }` and pull out the inner User selection set. */
function selectionSetFromQuery(query: string): SelectionSetNode {
  const doc: DocumentNode = parse(query);
  const op = doc.definitions[0];
  if (op?.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error('Expected operation definition');
  }
  const usersField = op.selectionSet.selections[0] as FieldNode;
  if (!usersField.selectionSet) {
    throw new Error('Expected selection set on `users`');
  }
  return usersField.selectionSet;
}

/**
 * Build a faked GraphQLResolveInfo where `info.returnType` is `[User!]!`
 * and `info.fieldNodes[0].selectionSet` is the parsed selection.
 */
function buildResolveInfo(
  rootType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  schema?: GraphQLSchema,
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
    schema: schema as unknown,
    fragments: {},
    rootValue: undefined,
    operation: undefined,
    variableValues: {},
    path: { prev: undefined, key: 'users', typename: undefined },
  } as unknown as GraphQLResolveInfo;
}

describe('applySelectionToCollection · mapper + renderer', () => {
  it('emits .select(...) for queried scalar fields only', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { id firstName } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    expect(selectCall).toBeDefined();
    // Order is set-iteration; just compare contents.
    expect([...(selectCall?.args ?? [])].sort()).toEqual(['firstName', 'id']);
    // No includes for a query without relations.
    expect(base.calls.find((c) => c.method === 'include')).toBeUndefined();
  });

  it('emits a plain .include(rel, refineFn) for a single-field relation', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { id posts { id title } } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    expect(includes[0]?.args).toEqual(['posts']);
    // Inner refine should select on the child.
    const innerSelect = includes[0]?.inner?.find((c) => c.method === 'select');
    expect(innerSelect).toBeDefined();
    expect([...(innerSelect?.args ?? [])].sort()).toEqual(['id', 'title']);
    // Not a combine.
    expect(includes[0]?.inner?.find((c) => c.method === 'combine')).toBeUndefined();
  });

  it('augments parent .select(...) with relation localFields (W-1 workaround)', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { firstName posts { id } } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    // `id` is the localField for posts (mock contract). It should be
    // added to the parent select even though the user didn't query for
    // User.id, so the orm-client's nested-stitch can match.
    expect([...(selectCall?.args ?? [])].sort()).toEqual(['firstName', 'id']);
  });

  it('collapses sibling fields on the same relation into a single .include + .combine', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { drafts { id } publishedPosts { id } } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    expect(includes[0]?.args).toEqual(['posts']);
    const combineCall = includes[0]?.inner?.find((c) => c.method === 'combine');
    expect(combineCall).toBeDefined();
    // Combine slots are namespaced by `<fieldAlias>:<specKey>` so
    // multiple consumers on the same relation never collide.
    expect([...((combineCall?.args[0] as string[]) ?? [])].sort()).toEqual([
      'drafts:posts',
      'publishedPosts:posts',
    ]);
  });

  it('puts a function-form count() spec as a branch in the same combine block as siblings', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { drafts { id } postCount } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    const combineCall = includes[0]?.inner?.find((c) => c.method === 'combine');
    // Namespaced `<fieldAlias>:<specKey>` — drafts uses a refined-
    // branch (single-key path) and postCount uses function-form.
    expect([...((combineCall?.args[0] as string[]) ?? [])].sort()).toEqual([
      'drafts:posts',
      'postCount:posts',
    ]);
    // The `count()` should have been called on the relation collection
    // before being passed into combine.
    const countCall = includes[0]?.inner?.find((c) => c.method === 'count');
    expect(countCall).toBeDefined();
  });

  it('emits combine when a function-form count() spec is queried alone (no peer rows)', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { postCount } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    const combineCall = includes[0]?.inner?.find((c) => c.method === 'combine');
    expect(combineCall).toBeDefined();
    expect(combineCall?.args[0]).toEqual(['postCount:posts']);
  });

  it('invokes the fluent `refine` refiner against the relation collection', () => {
    // `t.relation('posts', { refine: (rel) => rel.where({ published: 0 }) })`
    // shape: the mapper must invoke the callback with the relation's
    // collection and chain whatever the user returned. The recording
    // collection's `.where` call should land inside the .include's
    // refineFn invocation.
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { drafts { id } } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    expect(includes[0]?.args).toEqual(['posts']);
    expect(includes[0]?.inner?.find((c) => c.method === 'combine')).toBeUndefined();
    const whereCall = includes[0]?.inner?.find((c) => c.method === 'where');
    expect(whereCall).toBeDefined();
    expect(whereCall?.args[0]).toEqual({ published: 0 });
  });

  it('passes resolved field args and the request ctx to the `refine` callback', () => {
    // The mapper must thread per-field GraphQL args (resolved via
    // getArgumentValues against the parent type's field def) and the
    // request context into the user's refine callback.
    const captured: { args: unknown; ctx: unknown }[] = [];

    const Post = new ObjectType({
      name: 'Post',
      extensions: modelExt('Post'),
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
      }),
    });
    const User = new ObjectType({
      name: 'User',
      extensions: modelExt('User'),
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        posts: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
          args: {
            onlyPublished: { type: GraphQLBoolean },
          },
          // Outer-args select callback: args resolve once and the
          // resulting declarative refine closes over them.
          extensions: {
            pothosOptions: {
              select: (args: { onlyPublished?: boolean }, ctx: unknown) => {
                captured.push({ args, ctx });
                return {
                  posts: { where: { published: args.onlyPublished ? 1 : 0 } },
                };
              },
            },
          },
        },
      }),
    });

    const sel = selectionSetFromQuery('{ users { posts(onlyPublished: true) { id } } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    const ctx = { tenantId: 'tenant-42' };
    applySelectionToCollection(base as never, info, buildStubContract(), ctx);

    expect(captured).toHaveLength(1);
    expect(captured[0]?.args).toEqual({ onlyPublished: true });
    expect(captured[0]?.ctx).toBe(ctx);
    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    const whereCall = includes[0]?.inner?.find((c) => c.method === 'where');
    expect(whereCall?.args[0]).toEqual({ published: 1 });
  });

  it('selects the column name passed to exposeX, decoupled from the GraphQL field name', () => {
    // The mapper must read `pothosExposedField` (set by Pothos core for
    // every t.exposeID/Int/.../Boolean field) rather than shoving the
    // GraphQL field name into .select. Otherwise renaming the field
    // (`isPublished` over column `published`) silently breaks the SQL.
    const Post = new ObjectType({
      name: 'Post',
      extensions: modelExt('Post'),
      fields: () => ({
        // GraphQL field name `isPublished`, backing column `published`.
        isPublished: { type: GraphQLBoolean, extensions: exposed('published') },
      }),
    });
    const sel = selectionSetFromQuery('{ posts { isPublished } }');
    const info = buildResolveInfo(Post, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    expect(selectCall?.args).toEqual(['published']);
  });

  it('honours `t.field({ select: {...} })` for a computed resolver that needs columns', () => {
    // Multi-column dependency: `fullName: parent.firstName + ' ' + parent.lastName`
    // declares both columns via the contract-typed `select` option on
    // `t.field`. Pothos core preserves the original options at the field
    // config's `pothosOptions` extension; the mapper reads `select` off
    // that.
    const User = new ObjectType({
      name: 'User',
      extensions: modelExt('User'),
      fields: () => ({
        fullName: {
          type: new GraphQLNonNull(GraphQLString),
          extensions: {
            pothosOptions: { select: ['firstName', 'lastName'] },
          },
        },
      }),
    });
    const sel = selectionSetFromQuery('{ users { fullName } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    expect([...(selectCall?.args ?? [])].sort()).toEqual(['firstName', 'lastName']);
  });

  it('skips fields with no exposed column and no select dependency', () => {
    // A `t.field` with a constant resolver depends on no parent columns.
    // The mapper must not invent a SELECT for it.
    const User = new ObjectType({
      name: 'User',
      extensions: modelExt('User'),
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        // No exposed column, no select — pure compute.
        plugin: { type: new GraphQLNonNull(GraphQLString) },
      }),
    });
    const sel = selectionSetFromQuery('{ users { id plugin } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    expect(selectCall?.args).toEqual(['id']);
  });

  it('honors skipDeferredFragments: false plugin option (B1)', () => {
    // Default `skipDeferredFragments: true` drops `@defer`-ed fields from
    // the preload (they're fetched after the initial response). Setting
    // the option to `false` makes the mapper pull them into the same
    // SQL include eagerly.
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery(`{ users {
      id
      ... @defer { lastName }
    } }`);
    const info = { ...buildResolveInfo(User, sel), schema } as GraphQLResolveInfo;

    const baseDefault = createRecordingCollection();
    applySelectionToCollection(baseDefault as never, info, buildStubContract(), {});
    const defaultCols = (baseDefault.calls.find((c) => c.method === 'select')?.args ??
      []) as string[];
    expect(defaultCols).not.toContain('lastName');

    const baseInclude = createRecordingCollection();
    applySelectionToCollection(
      baseInclude as never,
      info,
      buildStubContract(),
      {},
      {
        skipDeferredFragments: false,
      },
    );
    const includedCols = (baseInclude.calls.find((c) => c.method === 'select')?.args ??
      []) as string[];
    expect(includedCols).toContain('lastName');
  });

  // NOTE: Cursor-pagination unit tests (A5: defaultConnectionSize
  // fallback, A2: refine-before-pagination ordering) used to live here
  // when `t.relatedConnection` emitted a `PRISMA_NEXT_PAGINATED`
  // extension that the walker dispatched on. After the unification
  // pass, both extension and walker dispatch are gone — cursor
  // pagination is applied inside the connection sugar's function-form
  // `select` callback, not by the walker. End-to-end coverage of A5 /
  // A2 lives in `tests/connection.test.ts`. The walker-level
  // invariants we still pin below cover the *unification* contract:
  // function-form `{ rows, count }` namespacing and field-level
  // `pothosIndirectInclude` same-row descent (t.variant compile target).

  it('function-form select returning { rows, count } namespaces under <alias>:', () => {
    // `t.relatedConnection` compiles to a function-form `pothosOptions.select`
    // that returns `{ rows, count }`. The walker must namespace each
    // inner spec key as `<fieldAlias>:<innerKey>` so the per-field
    // overlay can later lift `parent.rows` / `parent.count` cleanly.
    const Post = new ObjectType({
      name: 'Post',
      extensions: modelExt('Post'),
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
      }),
    });
    const PostEdge = new ObjectType({
      name: 'PostEdge',
      fields: () => ({
        cursor: { type: new GraphQLNonNull(GraphQLString) },
        node: { type: new GraphQLNonNull(Post) },
      }),
    });
    const PostsConnection = new ObjectType({
      name: 'PostsConnection',
      fields: () => ({
        edges: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostEdge))) },
        totalCount: { type: GraphQLInt },
      }),
    });
    const User = new ObjectType({
      name: 'User',
      extensions: modelExt('User'),
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        postsConnection: {
          type: PostsConnection,
          extensions: {
            pothosOptions: {
              select: () => ({
                posts: (sub: unknown) => {
                  const s = sub as RecordingCollection;
                  return { rows: s, count: s.count() };
                },
              }),
            },
          },
        },
      }),
    });
    const sel = selectionSetFromQuery(
      '{ users { id postsConnection { edges { node { id } } totalCount } } }',
    );
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const include = base.calls.find((c) => c.method === 'include' && c.args[0] === 'posts');
    expect(include).toBeDefined();
    const inner = include?.inner ?? [];
    const combine = inner.find((c) => c.method === 'combine');
    expect(combine).toBeDefined();
    // Inner spec keys should be namespaced: <alias>:rows and <alias>:count.
    expect(combine?.args[0]).toEqual(
      expect.arrayContaining(['postsConnection:rows', 'postsConnection:count']),
    );
  });

  it('field-level pothosIndirectInclude (no paths) descends into the named type — variant case', () => {
    // `t.variant` compiles to a field-level `pothosIndirectInclude`
    // with `getType` only (no paths). The walker should descend into
    // the named type's selection set on the SAME row, picking up the
    // variant's column reads as parent-level columns (no new
    // .include). `pothosOptions.select: string[]` (variant's `select`
    // option) forces extra columns onto the parent too.
    const AdminUser = new ObjectType({
      name: 'AdminUser',
      extensions: modelExt('User'),
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        secret: { type: new GraphQLNonNull(GraphQLString), extensions: exposed('secret') },
      }),
    });
    const User = new ObjectType({
      name: 'User',
      extensions: modelExt('User'),
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        asAdmin: {
          type: AdminUser,
          extensions: {
            pothosIndirectInclude: { getType: () => 'AdminUser' },
            pothosOptions: { select: ['role'] },
          },
        },
      }),
    });
    const schema = new GraphQLSchema({
      query: new ObjectType({
        name: 'Query',
        fields: { users: { type: new GraphQLList(User) } },
      }),
      types: [AdminUser],
    });
    const sel = selectionSetFromQuery('{ users { asAdmin { secret } } }');
    const info = buildResolveInfo(User, sel, schema);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    // Variant descends same-row: AdminUser's `secret` lands on parent
    // SELECT, plus forced `role` from the variant's select option.
    expect([...(selectCall?.args ?? [])].sort()).toEqual(
      expect.arrayContaining(['role', 'secret']),
    );
  });

  it('drops fields with @skip(if: true) from the SELECT', () => {
    // The mapper consults `@skip` / `@include` directive values before
    // collecting a field. Without this, the SELECT would include a
    // column the response will skip — wasted work and a potential
    // permission-check bypass in downstream plugins. (F3)
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery(
      '{ users { id firstName @skip(if: true) lastName @include(if: false) } }',
    );
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    expect(selectCall?.args).toEqual(['id']);
  });

  it('keeps fields with @skip(if: false) / @include(if: true)', () => {
    // The other half of F3 — the directive is present but inactive.
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery(
      '{ users { id firstName @skip(if: false) lastName @include(if: true) } }',
    );
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    expect([...(selectCall?.args ?? [])].sort()).toEqual(['firstName', 'id', 'lastName']);
  });

  it('descends through named fragments across multiple levels (F11)', () => {
    // Build a 3-deep fragment chain on the same User type. The mapper
    // must walk each fragment's selection set, merge columns/relations,
    // and reach the deepest column. plugin-prisma covers this; pin it
    // for our mapper too.
    const { schema, User } = buildFixtureSchema();
    const query = `
      query Test {
        users {
          ...UserA
        }
      }
      fragment UserA on User {
        id
        ...UserB
      }
      fragment UserB on User {
        firstName
        ...UserC
      }
      fragment UserC on User {
        lastName
        posts { id title }
      }
    `;
    const doc = parse(query);
    const op = doc.definitions[0];
    if (op?.kind !== Kind.OPERATION_DEFINITION) {
      throw new Error('expected op');
    }
    const usersField = op.selectionSet.selections[0] as FieldNode;
    if (!usersField.selectionSet) {
      throw new Error('expected selection set');
    }

    const fragments: Record<string, import('graphql').FragmentDefinitionNode> = {};
    for (const def of doc.definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION) {
        fragments[def.name.value] = def;
      }
    }

    const fakeFieldNode: FieldNode = {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'users' },
      selectionSet: usersField.selectionSet,
    };
    const info = {
      returnType: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))),
      fieldNodes: [fakeFieldNode],
      parentType: User,
      fieldName: 'users',
      schema,
      fragments,
      rootValue: undefined,
      operation: undefined,
      variableValues: {},
      path: { prev: undefined, key: 'users', typename: undefined },
    } as unknown as GraphQLResolveInfo;

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const selectCall = base.calls.find((c) => c.method === 'select');
    // Three fragments contributed `id` + `firstName` + `lastName` to
    // the parent SELECT. `id` is also the FK localField for `posts`
    // (already present).
    expect([...(selectCall?.args ?? [])].sort()).toEqual(['firstName', 'id', 'lastName']);
    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    expect(includes[0]?.args).toEqual(['posts']);
  });

  it('recurses into nested relations (depth ≥ 2)', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery(
      '{ users { posts { id comments { id author { firstName } } } } }',
    );
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const userIncludes = base.calls.filter((c) => c.method === 'include');
    expect(userIncludes).toHaveLength(1);
    expect(userIncludes[0]?.args).toEqual(['posts']);

    const postsInner = userIncludes[0]?.inner ?? [];
    const postsToCommentsInclude = postsInner.find(
      (c) => c.method === 'include' && c.args[0] === 'comments',
    );
    expect(postsToCommentsInclude).toBeDefined();

    const commentsInner = postsToCommentsInclude?.inner ?? [];
    const commentsToAuthorInclude = commentsInner.find(
      (c) => c.method === 'include' && c.args[0] === 'author',
    );
    expect(commentsToAuthorInclude).toBeDefined();
  });
});

// Reshape was removed when we adopted the "combine for to-many multi-alias /
// counts; plain include otherwise" emission. The resolver now reads
// `parent[relationName]` directly (or `parent[relationName][alias]` when
// the value is a combine-spec object). End-to-end behavior is covered by
// `runtime.test.ts` against a real sqlite database.
