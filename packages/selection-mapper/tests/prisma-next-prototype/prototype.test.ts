import { buildSchema, type GraphQLField, type GraphQLNamedType } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  getLoaderMapping,
  type IndirectInclude,
  planFromInfo,
  play,
  queryFromInfo,
  queryFromPlan,
  rowPlanFromInfo,
} from '../../src';
import { mappingOf, resolveInfo } from '../fake-adapter';
import { countPromises } from '../promise-spy';
import {
  emit,
  type MapperCollection,
  PN_MODEL,
  PN_SELECT,
  type PnModel,
  type PnSelectFn,
  type PnSpec,
  pnAdapter,
  RecordingCollection,
  render,
} from './adapter';

// ---------------------------------------------------------------------------------------------
// Models: what `PRISMA_NEXT_RELATIONS` / `PRISMA_NEXT_MODEL` would carry, one object per model.
// ---------------------------------------------------------------------------------------------

const User: PnModel = { name: 'User', relations: {} };
const Post: PnModel = { name: 'Post', relations: {} };
const Comment: PnModel = { name: 'Comment', relations: {} };

User.relations = { posts: { isToMany: true, localFields: ['id'], target: Post } };
Post.relations = {
  author: { isToMany: false, localFields: ['authorId'], target: User },
  comments: { isToMany: true, localFields: ['id'], target: Comment },
};

// ---------------------------------------------------------------------------------------------
// Sugar: what prisma-next's field builder compiles each helper to, as the adapter's spec.
// ---------------------------------------------------------------------------------------------

type Args = Record<string, unknown>;

interface Declarative {
  where?: unknown;
  orderBy?: unknown;
  take?: number;
  skip?: number;
}

/** `t.exposeX(column)`: a static column read. */
const expose = (column: string): PnSpec => ({ columns: [column] });

/** apply-selection ~744-766: a declarative `{ where, orderBy, take, skip }` as a refine. */
function declarativeRefine(literal: Declarative | undefined): PnSpec | undefined {
  if (!literal || Object.values(literal).every((value) => value === undefined)) {
    return undefined;
  }

  return {
    refine: (rel) => {
      let refined = rel;

      if (literal.where !== undefined) {
        refined = refined.where(literal.where);
      }

      if (literal.orderBy !== undefined) {
        refined = refined.orderBy(literal.orderBy);
      }

      if (literal.take !== undefined) {
        refined = refined.take(literal.take);
      }

      if (literal.skip !== undefined) {
        refined = refined.skip(literal.skip);
      }

      return refined;
    },
  };
}

/** `t.relation(name, { query })` (prisma-next-object-field-builder ~351-364). */
const relation =
  (name: string, query?: (args: Args) => Declarative, { async = false } = {}): PnSelectFn =>
  (args, _ctx, nested) => {
    const spec = nested(declarativeRefine(query?.(args as Args)));

    return async
      ? Promise.resolve(spec).then((resolved) => ({ relations: { [name]: resolved } }))
      : { relations: { [name]: spec } };
  };

/** `t.relationCount(name, { where })` (~450-485): a function-form entry reducing to `count()`. */
const relationCount =
  (name: string, where?: (args: Args) => unknown): PnSelectFn =>
  (args) => {
    const filter = where?.(args as Args);

    return {
      relations: {
        [name]: (sub: MapperCollection) => ({
          [name]: (filter === undefined ? sub : sub.where(filter)).count(),
        }),
      },
    };
  };

/**
 * `t.relatedConnection(name, { cursor, totalCount: true })` (~605-684): the rows branch is the
 * nested selection under `edges.node` / `nodes`, refined by cursor pagination and reading the
 * cursor column; the count is a second entry, gated on `totalCount` being selected.
 */
const relatedConnection =
  (name: string, target: string, cursor: string): PnSelectFn =>
  (args, _ctx, nested, selectedFieldNode) => {
    const first = ((args as { first?: number }).first ?? 20) + 1;
    const include: IndirectInclude = {
      getType: () => target,
      paths: [[{ name: 'edges' }, { name: 'node' }], [{ name: 'nodes' }]],
    };
    const rows = nested(
      { columns: [cursor], refine: (rel) => rel.orderBy({ [cursor]: 'asc' }).take(first) },
      include,
    );

    return {
      relations: {
        [name]: selectedFieldNode(['totalCount'])
          ? [{ ...rows, slot: 'rows' }, (sub: MapperCollection) => ({ count: sub.count() })]
          : { ...rows, slot: 'rows' },
      },
    };
  };

/**
 * `t.variant(type, { select })` (~279-305): the field-level `pothosIndirectInclude` without a
 * path, which the walker does not read, so the descent into the variant's selection set on the
 * same row is a nested plan whose query is merged back into this level.
 */
const variant =
  (select: readonly string[] = []): PnSelectFn =>
  (_args, _ctx, nested) => {
    const spec = nested(true);

    return { ...spec, columns: [...select, ...(spec.columns ?? [])] };
  };

// ---------------------------------------------------------------------------------------------
// Schema.
// ---------------------------------------------------------------------------------------------

const sdl = /* GraphQL */ `
  directive @defer(if: Boolean = true, label: String) on FRAGMENT_SPREAD | INLINE_FRAGMENT

  type Query {
    user: User
    admin: AdminUser
    viewer: Person
    node(id: ID!): Node
  }

  interface Node { id: ID }
  interface Person implements Node { id: ID, name: String, posts(take: Int, published: Boolean): [Post] }

  type User implements Node & Person {
    id: ID
    name: String
    email: String
    posts(take: Int, published: Boolean): [Post]
    postCount(published: Boolean): Int
    postsConnection(first: Int, after: String): PostConnection
    admin: AdminUser
  }

  type AdminUser implements Node & Person {
    id: ID
    name: String
    email: String
    permissions: String
    posts(take: Int, published: Boolean): [Post]
  }

  type Post { id: ID, title: String, author: User, comments: [Comment] }
  type Comment { id: ID, body: String }

  type PostConnection { totalCount: Int, edges: [PostEdge], nodes: [Post], pageInfo: PageInfo }
  type PostEdge { cursor: String, node: Post }
  type PageInfo { hasNextPage: Boolean }
`;

interface TypeSetup {
  model?: PnModel;
  select?: readonly string[] | PnSpec;
  fields?: Record<string, PnSpec | PnSelectFn>;
}

function createPrototypeSchema({ asyncPosts = false } = {}) {
  const schema = buildSchema(sdl);
  const postsQuery = (args: Args): Declarative => ({
    where: args.published === undefined ? undefined : { published: args.published },
    take: args.take as number | undefined,
  });
  const setup: Record<string, TypeSetup> = {
    Person: { model: User },
    User: {
      model: User,
      fields: {
        id: expose('id'),
        name: expose('name'),
        email: expose('email'),
        posts: relation('posts', postsQuery, { async: asyncPosts }),
        postCount: relationCount('posts', (args) =>
          args.published === undefined ? undefined : { published: args.published },
        ),
        postsConnection: relatedConnection('posts', 'Post', 'id'),
        admin: variant(['name']),
      },
    },
    // A variant of the User model with a type-level select: two columns and a count.
    AdminUser: {
      model: User,
      select: {
        columns: ['email'],
        relations: { posts: (sub: MapperCollection) => ({ total: sub.count() }) },
      },
      fields: {
        id: expose('id'),
        name: expose('name'),
        email: expose('email'),
        permissions: expose('permissions'),
        posts: relation('posts', postsQuery),
      },
    },
    Post: {
      model: Post,
      fields: {
        id: expose('id'),
        title: expose('title'),
        author: relation('author'),
        comments: relation('comments'),
      },
    },
    // A type-level select in the legacy column-array form.
    Comment: { model: Comment, select: ['id'], fields: { body: expose('body') } },
  };

  for (const [typeName, { model, select, fields }] of Object.entries(setup)) {
    const type = schema.getType(typeName) as GraphQLNamedType & {
      extensions: Record<string, unknown>;
      getFields: () => Record<string, GraphQLField<unknown, unknown>>;
    };

    type.extensions = { ...type.extensions, [PN_MODEL]: model, [PN_SELECT]: select };

    for (const [fieldName, selection] of Object.entries(fields ?? {})) {
      const field = type.getFields()[fieldName] as GraphQLField<unknown, unknown> & {
        extensions: Record<string, unknown>;
      };

      field.extensions = { ...field.extensions, [PN_SELECT]: selection };
    }
  }

  return schema;
}

const schema = createPrototypeSchema();

function chain(spec: PnSpec, model = User) {
  return render(emit(new RecordingCollection(), spec, model, {}));
}

async function plan(
  source: string,
  options: { typeName?: string; initial?: PnSpec; variableValues?: Record<string, unknown> } = {},
) {
  const { variableValues, ...entry } = options;
  const info = await resolveInfo(schema, source, { variableValues });

  return chain(queryFromInfo(pnAdapter, { context: {}, info, ...entry }));
}

function pathOf(...keys: (string | number)[]) {
  let path: { prev: unknown; key: string | number; typename: undefined } | undefined;

  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }

  return path as never;
}

// ---------------------------------------------------------------------------------------------
// Cases.
// ---------------------------------------------------------------------------------------------

describe('columns', () => {
  it('selects the columns of exposed fields', async () => {
    expect(await plan('{ user { id name } }')).toEqual(['select(id, name)']);
  });

  it('honours @skip and @include on fields (S-2)', async () => {
    expect(await plan('{ user { id name @skip(if: true) email @include(if: false) } }')).toEqual([
      'select(id)',
    ]);
  });

  it('plans without creating a promise when no select function is async', async () => {
    const info = await resolveInfo(
      schema,
      '{ user { id posts(take: 1) { title author { name } } } }',
    );
    const { result, promises } = countPromises(() =>
      queryFromInfo(pnAdapter, { context: {}, info }),
    );

    expect(promises).toBe(0);
    expect(chain(result)).toEqual([
      'select(id)',
      'include(posts){ take(1) select(title, authorId) include(author){ select(name) } }',
    ]);
  });
});

describe('relations', () => {
  it('includes a relation with its query as a refine and reads the parent FK columns (W-1)', async () => {
    expect(
      await plan('{ user { name posts(published: true, take: 2) { title author { name } } } }'),
    ).toEqual([
      'select(name, id)',
      'include(posts){ where({"published":true}) take(2) select(title, authorId) include(author){ select(name) } }',
    ]);
  });

  it('gives two aliases of one to-many relation their own combine slots', async () => {
    expect(await plan('{ user { recent: posts(take: 1) { id } all: posts { title } } }')).toEqual([
      'select(id)',
      'include(posts){ combine(recent:posts=[take(1) select(id)], all:posts=[select(title)]) }',
    ]);
  });

  it('unions one field selected under two fragments into one slot', async () => {
    expect(
      await plan(/* GraphQL */ `
        { user { ...A ...B } }
        fragment A on User { posts { id } }
        fragment B on User { posts { title } }
      `),
    ).toEqual(['select(id)', 'include(posts){ select(id, title) }']);
  });

  it('plans every node selecting the field into one root (W-1)', async () => {
    const source = /* GraphQL */ `
      query { user { posts(take: 1) { id } } ...More }
      fragment More on Query { user { posts(take: 1) { title } } }
    `;
    const info = await resolveInfo(schema, source);

    expect(info.fieldNodes).toHaveLength(2);
    expect(chain(queryFromInfo(pnAdapter, { context: {}, info }))).toEqual([
      'select(id)',
      'include(posts){ take(1) select(id, title) }',
    ]);
  });

  it('refuses a second alias on a to-one relation, as prisma-next does', async () => {
    const info = await resolveInfo(
      schema,
      '{ user { posts { a: author { id } b: author { name } } } }',
    );

    expect(() => queryFromInfo(pnAdapter, { context: {}, info })).toThrow(
      'Relation "author" is to-one — only one branch allowed, got alias "b:author" plus "a:author".',
    );
  });

  it('awaits an async relation select (A-6)', async () => {
    const asyncSchema = createPrototypeSchema({ asyncPosts: true });
    const info = await resolveInfo(asyncSchema, '{ user { id posts(take: 2) { title } } }');
    const spec = queryFromInfo(pnAdapter, { context: {}, info });

    expect(spec).toBeInstanceOf(Promise);
    expect(chain(await spec)).toEqual(['select(id)', 'include(posts){ take(2) select(title) }']);
  });
});

describe('type-level selects', () => {
  it('applies a type-level column select on every level it enters (S-1)', async () => {
    expect(await plan('{ user { posts { comments { body } } } }')).toEqual([
      'select(id)',
      'include(posts){ select(id) include(comments){ select(id, body) } }',
    ]);
  });

  it('slots a type-level relation entry under :object:<Type>', async () => {
    expect(await plan('{ admin { permissions } }')).toEqual([
      'select(email, id, permissions)',
      'include(posts){ combine(:object:AdminUser:total=count[]) }',
    ]);
  });
});

describe('counts', () => {
  it('emits a count as an in-include reducer inside a combine slot', async () => {
    expect(await plan('{ user { postCount(published: true) } }')).toEqual([
      'select(id)',
      'include(posts){ combine(postCount:posts=count[where({"published":true})]) }',
    ]);
  });

  it('puts a count beside a sibling branch of the same relation', async () => {
    expect(await plan('{ user { posts { id } n: postCount } }')).toEqual([
      'select(id)',
      'include(posts){ combine(posts:posts=[select(id)], n:posts=count[]) }',
    ]);
  });
});

describe('variants', () => {
  it('enters a variant through a fragment on a same-model interface before any field (S-7)', async () => {
    expect(await plan('{ viewer { id ... on AdminUser { permissions } } }')).toEqual([
      'select(email, id, permissions)',
      'include(posts){ combine(:object:AdminUser:total=count[]) }',
    ]);
  });

  it('merges a t.variant field as a nested plan of the same row', async () => {
    expect(await plan('{ user { id admin { permissions posts(take: 3) { title } } } }')).toEqual([
      'select(id, name, email, permissions)',
      'include(posts){ combine(posts:posts=[take(3) select(title)], :object:AdminUser:total=count[]) }',
    ]);
  });
});

describe('connections', () => {
  it('walks the connection paths as one nested selection, with cursor columns and a gated count', async () => {
    expect(
      await plan(/* GraphQL */ `{
        user {
          postsConnection(first: 2) {
            totalCount
            edges { node { title } }
            nodes { id author { name } }
          }
        }
      }`),
    ).toEqual([
      'select(id)',
      'include(posts){ combine(postsConnection:rows=[orderBy({"id":"asc"}) take(3) select(id, title, authorId) include(author){ select(name) }], postsConnection:count=count[]) }',
    ]);
  });

  it('stays on the single-include path without totalCount', async () => {
    expect(
      await plan('{ user { postsConnection(first: 2) { edges { node { title } } } } }'),
    ).toEqual(['select(id)', 'include(posts){ orderBy({"id":"asc"}) take(3) select(id, title) }']);
  });

  it('keeps the pagination when nothing under the paths is selected', async () => {
    expect(
      await plan('{ user { postsConnection(first: 2) { pageInfo { hasNextPage } } } }'),
    ).toEqual(['select(id)', 'include(posts){ orderBy({"id":"asc"}) take(3) select(id) }']);
  });
});

describe('entry points', () => {
  it('plans a typed entry for a node query, as node batching does (E-1 with typeName)', async () => {
    expect(
      await plan('{ node(id: "1") { id ... on User { name } ... on Post { title } } }', {
        typeName: 'User',
      }),
    ).toEqual(['select(id, name)']);
  });

  it('merges an initial selection first (E-1), as extraColumns would', async () => {
    expect(await plan('{ user { name } }', { initial: { columns: ['id'] } })).toEqual([
      'select(id, name)',
    ]);
  });

  it('rowPlanFromInfo plans the field into a row carrying the parent type select (E-2)', async () => {
    const info = await resolveInfo(schema, '{ admin { posts(take: 1) { id } } }', {
      at: ['AdminUser', 'posts'],
    });
    const plan = rowPlanFromInfo(pnAdapter, {}, info);

    expect(chain(pnAdapter.accumulator.emit(plan.root))).toEqual([
      'select(id, email)',
      'include(posts){ combine(posts:posts=[take(1) select(id)], :object:AdminUser:total=count[]) }',
    ]);
    // The plan records its mappings whatever the adapter does with them; this one reads rows
    // back through the per-resolve overlay and never looks them up.
    expect(Object.keys(plan.mappings)).toEqual(['AdminUser@posts']);
  });

  it('queryFromPlan emits the plan over a caller selection, and round-trips a serialized spec', async () => {
    const source = '{ user { recent: posts(take: 1) { id } n: postCount } }';
    const context = {};
    const plan = planFromInfo(pnAdapter, { context, info: await resolveInfo(schema, source) })!;
    const select: PnSpec = { columns: ['name'] };
    const expected = queryFromInfo(pnAdapter, {
      context: {},
      info: await resolveInfo(schema, source),
      initial: select,
    });

    expect(getLoaderMapping(context, pathOf('user', 'recent'), 'User')).toBe(null);

    const query = queryFromPlan(plan, select);

    expect(chain(query)).toEqual(chain(expected));
    expect(chain(query)).toEqual([
      'select(name, id)',
      'include(posts){ combine(recent:posts=[take(1) select(id)], n:posts=count[]) }',
    ]);
    // Emitting records the mappings, which this adapter simply never looks up.
    expect(mappingOf(getLoaderMapping(context, pathOf('user', 'recent'), 'User'))).toEqual({
      nested: { 'Post@id': { nested: {} } },
    });
    // A serialized spec merges back without a key: every entry carries its alias.
    expect(chain(queryFromPlan(plan))).toEqual(chain(pnAdapter.accumulator.emit(play(plan).root)));
  });
});
