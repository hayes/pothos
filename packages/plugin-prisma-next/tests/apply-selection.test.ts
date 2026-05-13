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
import { PRISMA_NEXT_FIELD_OP, PRISMA_NEXT_MODEL } from '../src/constants';
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
  // The fluent refiner shape the mapper expects:
  // `(rel, args, ctx) => rel.<chain>`. Tests pass a function that mimics
  // calling `.where(...)` on the recording collection and returning it.
  refine?: (rel: RecordingCollection, args: unknown, ctx: unknown) => RecordingCollection;
}

function relationExt(spec: RelationExtSpec): Record<string, unknown> {
  return {
    [PRISMA_NEXT_FIELD_OP]: {
      kind: 'include',
      relationName: spec.relationName,
      parentModel: spec.parentModel,
      isToMany: spec.isToMany,
      ...(spec.refine ? { refine: spec.refine } : {}),
    },
  };
}

function relationCountExt(relationName: string, parentModel: string): Record<string, unknown> {
  return {
    [PRISMA_NEXT_FIELD_OP]: {
      kind: 'count',
      relationName,
      parentModel,
    },
  };
}

interface PaginatedRelationExtSpec {
  relationName: string;
  parentModel: string;
  cursor: string | readonly string[];
  refine?: (rel: RecordingCollection, args: unknown, ctx: unknown) => RecordingCollection;
  totalCountAlias?: string;
}

function paginatedRelationExt(spec: PaginatedRelationExtSpec): Record<string, unknown> {
  return {
    [PRISMA_NEXT_FIELD_OP]: {
      kind: 'paginatedInclude',
      relationName: spec.relationName,
      parentModel: spec.parentModel,
      cursor: spec.cursor,
      paths: [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
      ...(spec.refine ? { refine: spec.refine } : {}),
      ...(spec.totalCountAlias ? { totalCountAlias: spec.totalCountAlias } : {}),
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
    extensions: { [PRISMA_NEXT_MODEL]: 'Comment' },
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
    extensions: { [PRISMA_NEXT_MODEL]: 'Post' },
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
    extensions: { [PRISMA_NEXT_MODEL]: 'User' },
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
          refine: (rel) => rel.where({ published: 0 }),
        }),
      },
      publishedPosts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        extensions: relationExt({
          relationName: 'posts',
          parentModel: 'User',

          isToMany: true,
          refine: (rel) => rel.where({ published: 1 }),
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
          posts: { on: { localFields: ['id'] } },
          bestFriend: { on: { localFields: ['bestFriendId'] } },
        },
      },
      Post: {
        relations: {
          comments: { on: { localFields: ['id'] } },
          author: { on: { localFields: ['authorId'] } },
        },
      },
      Comment: {
        relations: {
          author: { on: { localFields: ['authorId'] } },
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
    schema: undefined,
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
    expect([...((combineCall?.args[0] as string[]) ?? [])].sort()).toEqual([
      'drafts',
      'publishedPosts',
    ]);
  });

  it('puts t.relationCount as a count() branch in the same combine block as siblings', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { drafts { id } postCount } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    const combineCall = includes[0]?.inner?.find((c) => c.method === 'combine');
    expect([...((combineCall?.args[0] as string[]) ?? [])].sort()).toEqual(['drafts', 'postCount']);
    // The `count()` should have been called on the relation collection
    // before being passed into combine.
    const countCall = includes[0]?.inner?.find((c) => c.method === 'count');
    expect(countCall).toBeDefined();
  });

  it('emits combine when a relationCount is queried alone (no peer rows)', () => {
    const { User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { postCount } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const includes = base.calls.filter((c) => c.method === 'include');
    expect(includes).toHaveLength(1);
    const combineCall = includes[0]?.inner?.find((c) => c.method === 'combine');
    expect(combineCall).toBeDefined();
    expect(combineCall?.args[0]).toEqual(['postCount']);
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
      extensions: { [PRISMA_NEXT_MODEL]: 'Post' },
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
      }),
    });
    const User = new ObjectType({
      name: 'User',
      extensions: { [PRISMA_NEXT_MODEL]: 'User' },
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        posts: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
          args: {
            onlyPublished: { type: GraphQLBoolean },
          },
          extensions: relationExt({
            relationName: 'posts',
            parentModel: 'User',

            isToMany: true,
            refine: (rel, args, ctx) => {
              captured.push({ args, ctx });
              const a = args as { onlyPublished?: boolean };
              return rel.where({ published: a.onlyPublished ? 1 : 0 });
            },
          }),
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
      extensions: { [PRISMA_NEXT_MODEL]: 'Post' },
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
      extensions: { [PRISMA_NEXT_MODEL]: 'User' },
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
      extensions: { [PRISMA_NEXT_MODEL]: 'User' },
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

  it('paginatedInclude falls back to schema-wide defaultConnectionSize (A5)', () => {
    // No per-field `defaultSize` and no GraphQL `first`/`last` arg —
    // the mapper must honor the schema-wide default threaded through
    // `applySelectionToCollection`. Otherwise the SQL include limit
    // diverges from the resolver's view (resolver reads the option
    // directly; mapper would have used its own default).
    const PostEdgeA: GraphQLObjectType = new ObjectType({
      name: 'PostEdgeA',
      fields: () => ({
        cursor: { type: new GraphQLNonNull(GraphQLString) },
        node: { type: new GraphQLNonNull(Post) },
      }),
    });
    const PostsConnectionA: GraphQLObjectType = new ObjectType({
      name: 'PostsConnectionA',
      fields: () => ({
        edges: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostEdgeA))) },
      }),
    });
    const Post: GraphQLObjectType = new ObjectType({
      name: 'Post',
      extensions: { [PRISMA_NEXT_MODEL]: 'Post' },
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
      }),
    });
    const User = new ObjectType({
      name: 'User',
      extensions: { [PRISMA_NEXT_MODEL]: 'User' },
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        postsConnection: {
          type: PostsConnectionA,
          extensions: paginatedRelationExt({
            relationName: 'posts',
            parentModel: 'User',
            cursor: 'id',
          }),
        },
      }),
    });
    const sel = selectionSetFromQuery('{ users { id postsConnection { edges { node { id } } } } }');
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(
      base as never,
      info,
      buildStubContract(),
      {},
      {
        defaultConnectionSize: 7,
      },
    );

    const include = base.calls.find((c) => c.method === 'include' && c.args[0] === 'posts');
    const inner = include?.inner ?? [];
    const take = inner.find((c) => c.method === 'take');
    expect(take).toBeDefined();
    // `take(limit + 1)` over-fetches by one for hasNextPage detection.
    expect(take?.args).toEqual([8]);
  });

  it('paginatedInclude applies refine BEFORE pagination (A2)', () => {
    // The relation refine narrows the row set; cursor pagination
    // (`take(N+1)`) must run on the FILTERED set so `first: N` returns
    // up to N matching rows. Old order was `pagination → refine → inner`
    // which would `take(N+1)` of the unfiltered set and then filter,
    // potentially missing matches.
    //
    // The recorded call order on the inner refine collection should be:
    //   .where(refine predicate) → .where(cursor predicate) (none here) →
    //   .orderBy(cursor) → .take(limit)
    //
    // We assert: the first .where (refine) precedes .orderBy + .take.
    const PostEdge: GraphQLObjectType = new ObjectType({
      name: 'PostEdge',
      fields: () => ({
        cursor: { type: new GraphQLNonNull(GraphQLString) },
        node: { type: new GraphQLNonNull(Post) },
      }),
    });
    const PostsConnection: GraphQLObjectType = new ObjectType({
      name: 'PostsConnection',
      fields: () => ({
        edges: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostEdge))) },
      }),
    });
    const Post: GraphQLObjectType = new ObjectType({
      name: 'Post',
      extensions: { [PRISMA_NEXT_MODEL]: 'Post' },
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        published: { type: new GraphQLNonNull(GraphQLBoolean), extensions: exposed('published') },
      }),
    });
    const refineMarker = { kind: 'refine-where' };
    const User = new ObjectType({
      name: 'User',
      extensions: { [PRISMA_NEXT_MODEL]: 'User' },
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID), extensions: exposed('id') },
        postsConnection: {
          type: PostsConnection,
          extensions: paginatedRelationExt({
            relationName: 'posts',
            parentModel: 'User',
            cursor: 'id',
            refine: (rel) => rel.where(refineMarker),
          }),
        },
      }),
    });
    const sel = selectionSetFromQuery(
      '{ users { id postsConnection { edges { node { id published } } } } }',
    );
    const info = buildResolveInfo(User, sel);

    const base = createRecordingCollection();
    applySelectionToCollection(base as never, info, buildStubContract(), {});

    const include = base.calls.find((c) => c.method === 'include' && c.args[0] === 'posts');
    expect(include).toBeDefined();
    const inner = include?.inner ?? [];

    const refineWhereIdx = inner.findIndex(
      (c) => c.method === 'where' && c.args[0] === refineMarker,
    );
    const orderByIdx = inner.findIndex((c) => c.method === 'orderBy');
    const takeIdx = inner.findIndex((c) => c.method === 'take');

    expect(refineWhereIdx).toBeGreaterThanOrEqual(0);
    expect(orderByIdx).toBeGreaterThanOrEqual(0);
    expect(takeIdx).toBeGreaterThanOrEqual(0);
    // Refine must come BEFORE pagination steps.
    expect(refineWhereIdx).toBeLessThan(orderByIdx);
    expect(refineWhereIdx).toBeLessThan(takeIdx);
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
