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
import { PRISMA_NEXT_FIELD_OP, PRISMA_NEXT_MODEL } from '../src/constants';
import type { AnyContract } from '../src/types';
import { mapSelectionFromInfo } from '../src/utils/map-query';
import type { PrismaNextSelection } from '../src/utils/selection';

/** Shape `t.exposeX` writes — column dependency on the parent row. */
function exposed(column: string): { pothosExposedField: string } {
  return { pothosExposedField: column };
}

function relationExt(spec: {
  relationName: string;
  parentModel: string;
  isToMany: boolean;
}): Record<string, unknown> {
  return {
    [PRISMA_NEXT_FIELD_OP]: {
      kind: 'include',
      ...spec,
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

/**
 * Convert a `PrismaNextSelection` to a plain JSON-friendly tree.
 * Sorts everything alphabetically so column-insert order doesn't
 * change snapshots when the upstream mapper iteration changes.
 */
function selectionToPlain(sel: PrismaNextSelection): unknown {
  const out: Record<string, unknown> = {
    columns: [...sel.columns].sort(),
  };
  if (sel.relations.size > 0) {
    const relations: Record<string, unknown> = {};
    for (const [name, rel] of [...sel.relations.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const r: Record<string, unknown> = { isToMany: rel.isToMany };
      if (rel.branches.size > 0) {
        const branches: Record<string, unknown> = {};
        for (const [alias, b] of [...rel.branches.entries()].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          branches[alias] = {
            args: b.args,
            parentFkColumns: b.parentFkColumns,
            hasRefine: b.refine !== undefined,
            pagination: b.pagination ?? null,
            inner: selectionToPlain(b.inner),
          };
        }
        r.branches = branches;
      }
      if (rel.counts.size > 0) {
        const counts: Record<string, unknown> = {};
        for (const [alias, c] of [...rel.counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          counts[alias] = {
            args: c.args,
            hasRefine: c.refine !== undefined,
            hasWhere: c.where !== undefined,
          };
        }
        r.counts = counts;
      }
      if (rel.aggregates.size > 0) {
        const aggregates: Record<string, unknown> = {};
        for (const [alias, a] of [...rel.aggregates.entries()].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          aggregates[alias] = { args: a.args, hasAggregate: typeof a.aggregate === 'function' };
        }
        r.aggregates = aggregates;
      }
      relations[name] = r;
    }
    out.relations = relations;
  }
  return out;
}

function buildFixtureSchema() {
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
        extensions: {
          [PRISMA_NEXT_FIELD_OP]: {
            kind: 'include',
            relationName: 'posts',
            parentModel: 'User',
            isToMany: true,
            refine: (rel: { where: (w: unknown) => unknown }) => rel.where({ published: 0 }),
          },
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
        posts: { on: { localFields: ['id'] } },
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

describe('mapper · PrismaNextSelection snapshots', () => {
  it('snapshots scalar columns only', () => {
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { id firstName } }');
    const info = buildResolveInfo(User, sel, schema);

    const result = mapSelectionFromInfo({
      config: { contract: stubContract, skipDeferredFragments: true },
      context: {},
      info,
    });

    expect(selectionToPlain(result)).toMatchInlineSnapshot(`
      {
        "columns": [
          "firstName",
          "id",
        ],
      }
    `);
  });

  it('snapshots a single relation with FK augmentation', () => {
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { firstName posts { id title } } }');
    const info = buildResolveInfo(User, sel, schema);

    const result = mapSelectionFromInfo({
      config: { contract: stubContract, skipDeferredFragments: true },
      context: {},
      info,
    });

    // Parent columns include `id` (the FK localField for `posts`) even
    // though the user only asked for `firstName`. The relation's inner
    // selection captures `id`/`title` as the include's columns.
    expect(selectionToPlain(result)).toMatchInlineSnapshot(`
      {
        "columns": [
          "firstName",
          "id",
        ],
        "relations": {
          "posts": {
            "branches": {
              "posts": {
                "args": {},
                "hasRefine": false,
                "inner": {
                  "columns": [
                    "id",
                    "title",
                  ],
                },
                "pagination": null,
                "parentFkColumns": [
                  "id",
                ],
              },
            },
            "isToMany": true,
          },
        },
      }
    `);
  });

  it('snapshots sibling aliases on the same relation (combine shape)', () => {
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { posts { id } drafts { id } postCount } }');
    const info = buildResolveInfo(User, sel, schema);

    const result = mapSelectionFromInfo({
      config: { contract: stubContract, skipDeferredFragments: true },
      context: {},
      info,
    });

    // `posts`, `drafts`, and `postCount` all target the `posts`
    // relation: 2 aliased branches + 1 count. The renderer will emit
    // `cb.combine({ posts, drafts, postCount })`.
    expect(selectionToPlain(result)).toMatchInlineSnapshot(`
      {
        "columns": [
          "id",
        ],
        "relations": {
          "posts": {
            "branches": {
              "drafts": {
                "args": {},
                "hasRefine": true,
                "inner": {
                  "columns": [
                    "id",
                  ],
                },
                "pagination": null,
                "parentFkColumns": [
                  "id",
                ],
              },
              "posts": {
                "args": {},
                "hasRefine": false,
                "inner": {
                  "columns": [
                    "id",
                  ],
                },
                "pagination": null,
                "parentFkColumns": [
                  "id",
                ],
              },
            },
            "counts": {
              "postCount": {
                "args": {},
                "hasRefine": false,
                "hasWhere": false,
              },
            },
            "isToMany": true,
          },
        },
      }
    `);
  });

  it('snapshots nested relations (depth-2)', () => {
    const { schema, User } = buildFixtureSchema();
    const sel = selectionSetFromQuery('{ users { posts { title comments { id body } } } }');
    const info = buildResolveInfo(User, sel, schema);

    const result = mapSelectionFromInfo({
      config: { contract: stubContract, skipDeferredFragments: true },
      context: {},
      info,
    });

    // Recursive descent: posts.inner has columns + a `comments`
    // relation whose inner has columns. Each level's FK augmentation
    // fires independently.
    expect(selectionToPlain(result)).toMatchInlineSnapshot(`
      {
        "columns": [
          "id",
        ],
        "relations": {
          "posts": {
            "branches": {
              "posts": {
                "args": {},
                "hasRefine": false,
                "inner": {
                  "columns": [
                    "id",
                    "title",
                  ],
                  "relations": {
                    "comments": {
                      "branches": {
                        "comments": {
                          "args": {},
                          "hasRefine": false,
                          "inner": {
                            "columns": [
                              "body",
                              "id",
                            ],
                          },
                          "pagination": null,
                          "parentFkColumns": [
                            "id",
                          ],
                        },
                      },
                      "isToMany": true,
                    },
                  },
                },
                "pagination": null,
                "parentFkColumns": [
                  "id",
                ],
              },
            },
            "isToMany": true,
          },
        },
      }
    `);
  });

  it('fragment cycle (A → B → A) walked through mapSelectionFromInfo does not stack-overflow', async () => {
    // Defense-in-depth: GraphQL.js's NoFragmentCyclesRule rejects cycles
    // at validation. Hosts running execute() without validate()
    // (persisted queries / custom executors) could let one through —
    // the visited-set in `collectSelections` keeps the walk finite.
    const { mapSelectionFromInfo } = await import('../src/utils/map-query');
    const User = new ObjectType({
      name: 'User',
      extensions: { pothosPrismaNextModel: 'User' },
      fields: () => ({
        id: { type: new GraphQLNonNull(GraphQLID) },
      }),
    });
    const schema = new GraphQLSchema({ query: User });
    const info = {
      schema,
      fieldNodes: [
        {
          kind: 'Field',
          name: { kind: 'Name', value: 'user' },
          selectionSet: {
            kind: 'SelectionSet',
            selections: [{ kind: 'FragmentSpread', name: { kind: 'Name', value: 'A' } }],
          },
        },
      ],
      returnType: User,
      fragments: {
        A: {
          kind: 'FragmentDefinition',
          name: { kind: 'Name', value: 'A' },
          typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
          selectionSet: {
            kind: 'SelectionSet',
            selections: [{ kind: 'FragmentSpread', name: { kind: 'Name', value: 'B' } }],
          },
        },
        B: {
          kind: 'FragmentDefinition',
          name: { kind: 'Name', value: 'B' },
          typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
          selectionSet: {
            kind: 'SelectionSet',
            selections: [{ kind: 'FragmentSpread', name: { kind: 'Name', value: 'A' } }],
          },
        },
      },
      variableValues: {},
    } as never;
    // Completes in bounded time; the cyclic fragments contain no
    // columns, so the resulting tree is empty.
    const selection = mapSelectionFromInfo({
      config: { contract: { models: {} } as never, skipDeferredFragments: true },
      context: {},
      info,
    });
    expect(selection.columns.size).toBe(0);
    expect(selection.relations.size).toBe(0);
  });
});
