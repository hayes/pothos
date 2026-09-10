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

  override read(query: FakeMap, model: FakeModel, visit: FakeVisitor) {
    this.visitors.push(visit);
    super.read(query, model, visit);
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
    const node = new FakeAdapter().create(models.User);

    expect(node.columns).toEqual(new Set());
    expect(node.relations.size).toBe(0);
    expect(node.extras.size).toBe(0);
    expect(node.args).toEqual({});
  });

  it('creates a relation node once and returns it afterwards', () => {
    const node = new FakeAdapter().create(models.User);
    const posts = relation(node, 'posts', models.Post, {});

    expect(posts.model).toBe(models.Post);
    expect(relation(node, 'posts', models.Post, true)).toBe(posts);
    expect([...node.relations.keys()]).toEqual(['posts']);
  });

  it('rejects a promise as a relation value (A-6)', () => {
    const node = new FakeAdapter().create(models.User);

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
    const node = adapter.create(models.User);

    adapter.merge(node, NESTED);

    // Three levels deep, one visitor.
    expect(visitors.length).toBe(3);
    expect(new Set(visitors).size).toBe(1);

    const [merger] = visitors;

    adapter.merge(adapter.create(models.User), NESTED);

    expect(new Set(visitors).size).toBe(1);
    expect(visitors[3]).toBe(merger);
  });

  it('reads every level of a check with one visitor, and a different one from the merge', () => {
    const adapter = new RecordingAdapter();
    const { visitors } = adapter;
    const node = adapter.create(models.User);

    adapter.merge(node, NESTED);

    const merger = visitors[0];

    visitors.length = 0;
    expect(adapter.accepts(node, NESTED)).toBe(true);

    // Every level, because every relation is already on the node.
    expect(visitors.length).toBe(3);
    expect(new Set(visitors).size).toBe(1);
    expect(visitors[0]).not.toBe(merger);
  });

  it('leaves a conflicting relation out of a lenient merge and keeps the rest (E-2)', () => {
    const adapter = new FakeAdapter();
    const node = adapter.create(models.User);

    adapter.merge(node, { select: { posts: { take: 2, select: { id: true } } } });
    adapter.merge(
      node,
      { select: { id: true, posts: { take: 5, select: { id: true } } } },
      { lenient: true },
    );

    expect(adapter.emit(node)).toEqual({
      select: { id: true, posts: { take: 2, select: { id: true } } },
    });
  });

  it('adds no columns for a relation query without a selection of its own (E-3)', () => {
    const adapter = new FakeAdapter();
    const node = adapter.create(models.User);

    adapter.merge(node, { take: 2 }, { asQuery: true });

    expect(node.columns).toEqual(new Set());
    expect(adapter.emit(node)).toEqual({ take: 2, select: {} });
  });

  it('absorbs a node without serializing it', () => {
    const adapter = new FakeAdapter();
    const into = adapter.create(models.User);
    const from = adapter.create(models.User);

    adapter.merge(into, { select: { id: true } });
    adapter.merge(from, NESTED);

    expect(adapter.acceptsFrom(into, from)).toBe(true);
    adapter.absorb(into, from);

    expect(adapter.emit(into)).toEqual(adapter.emit(from));
  });
});
