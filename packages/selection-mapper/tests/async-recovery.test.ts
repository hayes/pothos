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
