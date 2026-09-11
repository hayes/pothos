import type { GraphQLNamedType } from 'graphql';
import { expect, it } from 'vitest';
import { type Node, Plan } from '../src';
import {
  createModels,
  createSchema,
  FakeAdapter,
  type FakeMap,
  type FakeModel,
  resolveInfo,
} from './fake-adapter';

it('allows an async select to recover from an awaited nested query failure', async () => {
  const models = createModels('User', 'Post');
  models.User.relations.posts = models.Post;
  const schema = createSchema(
    'type Query { user: User } type User { id: ID posts: [Post] } type Post { title: String }',
    {
      User: {
        model: 'User',
        select: { select: { id: true } },
        fields: {
          posts: async (_args, _context, nested): Promise<FakeMap> => {
            try {
              return {
                select: {
                  posts: await nested(
                    Promise.reject(new Error('remote query configuration unavailable')),
                  ),
                },
              };
            } catch {
              return { select: { posts: await nested({}) } };
            }
          },
        },
      },
      Post: { model: 'Post', select: { select: { title: true } } },
    },
  );
  const info = await resolveInfo(schema, '{ user { posts { title } } }');
  const plan = (await Plan.fromInfo(new FakeAdapter(models), { context: {}, info }))!;
  expect(plan.query()).toEqual({ select: { id: true, posts: { select: { title: true } } } });
});

it.each([
  false,
  true,
])('does not publish nested mappings when serialization fails (async query: %s)', async (asyncQuery) => {
  const models = createModels('User', 'Post');
  models.User.relations.posts = models.Post;
  class FailingSerializer extends FakeAdapter {
    override toQuery(node: Node<FakeModel>): FakeMap {
      if (node.model === models.Post) {
        throw new Error('Post query serialization failed');
      }
      return super.toQuery(node);
    }
  }
  const schema = createSchema(
    'type Query { user: User } type User { id: ID posts: [Post] } type Post { title: String }',
    {
      User: {
        model: 'User',
        select: { select: { id: true } },
        fields: {
          posts: async (_args, _context, nested): Promise<FakeMap> => {
            try {
              return { select: { posts: await nested(asyncQuery ? Promise.resolve({}) : {}) } };
            } catch {
              // The resolver can recover using only the parent's ID. Nothing from the failed
              // child query was loaded, so its title field must retain its fallback.
              return { select: { id: true } };
            }
          },
        },
      },
      Post: {
        model: 'Post',
        select: { select: {} },
        fields: { title: { select: { title: true } } },
      },
    },
  );
  const info = await resolveInfo(schema, '{ user { posts { title } } }');
  const plan = (await Plan.fromInfo(new FailingSerializer(models), { context: {}, info }))!;
  expect(plan.query()).toEqual({ select: { id: true } });
  expect(plan.play().mappings['User@posts'].nested).toEqual({});
});

it('handles an already-started query when nested path validation throws', async () => {
  const models = createModels('User');
  let rejectQuery!: (reason: Error) => void;
  const pending = new Promise<never>((_resolve, reject) => {
    rejectQuery = reject;
  });
  const schema = createSchema('type Query { user: User } type User { id: ID }', {
    User: {
      model: 'User',
      fields: { id: (_args, _context, nested) => nested(pending, ['missing']) },
    },
  });
  const info = await resolveInfo(schema, '{ user { id } }');
  const unhandled: unknown[] = [];
  const onUnhandled = (error: unknown) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  try {
    expect(() => Plan.fromInfo(new FakeAdapter(models), { context: {}, info })).toThrow();
    rejectQuery(new Error('query failed'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

it('handles a query callback promise when looking up the nested model throws', async () => {
  const models = createModels('User', 'Post');
  models.User.relations.posts = models.Post;
  const modelError = new Error('nested model unavailable');
  class FailingModelAdapter extends FakeAdapter {
    override modelFor(type: GraphQLNamedType) {
      if (type.name === 'Post') {
        throw modelError;
      }
      return super.modelFor(type);
    }
  }
  let rejectQuery!: (reason: Error) => void;
  const schema = createSchema(
    'type Query { user: User } type User { posts: [Post] } type Post { id: ID }',
    {
      User: {
        model: 'User',
        fields: {
          posts: (_args, _context, nested) =>
            nested(
              () =>
                new Promise<never>((_resolve, reject) => {
                  rejectQuery = reject;
                }),
            ),
        },
      },
      Post: { model: 'Post' },
    },
  );
  const info = await resolveInfo(schema, '{ user { posts { id } } }');
  const unhandled: unknown[] = [];
  const onUnhandled = (error: unknown) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  try {
    expect(() => Plan.fromInfo(new FailingModelAdapter(models), { context: {}, info })).toThrow(
      modelError,
    );
    rejectQuery(new Error('query failed'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
