import { describe, expect, it } from 'vitest';
import { relation } from '../src/node.js';
import {
  createModels,
  FakeAdapter,
  type FakeMap,
  type FakeModel,
  type FakeVisitor,
} from './fake-adapter';

const models = createModels('User', 'Post', 'Comment');

models.User.relations = { posts: models.Post };
models.Post.relations = { comments: models.Comment };

/** The fake adapter, with every visitor its key loop is handed recorded. */
class RecordingAdapter extends FakeAdapter {
  readonly visitors: FakeVisitor[] = [];

  override visitQuery(query: FakeMap, model: FakeModel, visit: FakeVisitor) {
    this.visitors.push(visit);
    super.visitQuery(query, model, visit);
  }
}

const NESTED: FakeMap = {
  select: {
    id: true,
    posts: { take: 2, select: { id: true, comments: { select: { id: true } } } },
  },
};

describe('node', () => {
  it('starts in named-column mode with no relations', () => {
    const node = new FakeAdapter().createNode(models.User);

    expect(node.columns).toEqual(new Set());
    expect(node.relations.size).toBe(0);
    expect(node.computed.size).toBe(0);
    expect(node.args).toEqual({});
  });

  it('creates a relation node once and returns it afterwards', () => {
    const node = new FakeAdapter().createNode(models.User);
    const posts = relation(node, 'posts', models.Post, {});

    expect(posts.model).toBe(models.Post);
    expect(relation(node, 'posts', models.Post, true)).toBe(posts);
    expect([...node.relations.keys()]).toEqual(['posts']);
  });

  it('rejects a promise as a relation value', () => {
    const node = new FakeAdapter().createNode(models.User);

    expect(() => relation(node, 'posts', models.Post, Promise.resolve({}))).toThrow(
      'Relation "posts" was given a promise. Await nestedSelection()',
    );
    expect(node.relations.size).toBe(0);
  });
});

describe('NodeAdapter', () => {
  /**
   * The classifier is a visitor, not a parse: one visitor per adapter, re-used down the tree by
   * saving and restoring its cursor, so a merge allocates only what the adapter's own key loop
   * already allocated.
   */
  it('reads every level of a merge with one visitor, and reuses it across merges', () => {
    const adapter = new RecordingAdapter();
    const { visitors } = adapter;
    const node = adapter.createNode(models.User);

    adapter.mergeQuery(node, NESTED);

    // Three levels deep, one visitor.
    expect(visitors.length).toBe(3);
    expect(new Set(visitors).size).toBe(1);

    const [merger] = visitors;

    adapter.mergeQuery(adapter.createNode(models.User), NESTED);

    expect(new Set(visitors).size).toBe(1);
    expect(visitors[3]).toBe(merger);
  });

  it('reads every level of a check with one visitor, and a different one from the merge', () => {
    const adapter = new RecordingAdapter();
    const { visitors } = adapter;
    const node = adapter.createNode(models.User);

    adapter.mergeQuery(node, NESTED);

    const merger = visitors[0];

    visitors.length = 0;
    expect(adapter.canMergeQuery(node, NESTED)).toBe(true);

    // Every level, because every relation is already on the node.
    expect(visitors.length).toBe(3);
    expect(new Set(visitors).size).toBe(1);
    expect(visitors[0]).not.toBe(merger);
  });

  it('leaves a conflicting relation out of a lenient merge and keeps the rest', () => {
    const adapter = new FakeAdapter();
    const node = adapter.createNode(models.User);

    adapter.mergeQuery(node, { select: { posts: { take: 2, select: { id: true } } } });
    adapter.mergeQuery(
      node,
      { select: { id: true, posts: { take: 5, select: { id: true } } } },
      { lenient: true },
    );

    expect(adapter.toQuery(node)).toEqual({
      select: { id: true, posts: { take: 2, select: { id: true } } },
    });
  });

  it('adds no columns for a relation query without a selection of its own', () => {
    const adapter = new FakeAdapter();
    const node = adapter.createNode(models.User);

    adapter.mergeQuery(node, { take: 2 }, { asQuery: true });

    expect(node.columns).toEqual(new Set());
    expect(adapter.toQuery(node)).toEqual({ take: 2, select: {} });
  });

  it('merges one node into another without serializing it', () => {
    const adapter = new FakeAdapter();
    const into = adapter.createNode(models.User);
    const from = adapter.createNode(models.User);

    adapter.mergeQuery(into, { select: { id: true } });
    adapter.mergeQuery(from, NESTED);

    expect(adapter.canMergeNode(into, from)).toBe(true);
    adapter.mergeNode(into, from);

    expect(adapter.toQuery(into)).toEqual(adapter.toQuery(from));
  });
});
