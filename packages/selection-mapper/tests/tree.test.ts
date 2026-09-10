import { describe, expect, it } from 'vitest';
import type { EntryVisitor, QueryFormat } from '../src';
import { treeAccumulator } from '../src';
import { createFakeFormat, createModels, type FakeMap, type FakeModel } from './fake-adapter';

const models = createModels('User', 'Post', 'Comment');

models.User.relations = { posts: models.Post };
models.Post.relations = { comments: models.Comment };

/** The fake format, with every visitor it is handed recorded. */
function recordingFormat(): {
  format: QueryFormat<FakeModel, FakeMap>;
  visitors: EntryVisitor<FakeModel, FakeMap>[];
} {
  const fake = createFakeFormat();
  const visitors: EntryVisitor<FakeModel, FakeMap>[] = [];

  return {
    visitors,
    format: {
      ...fake,
      read(query, model, visit) {
        visitors.push(visit);
        fake.read(query, model, visit);
      },
    },
  };
}

const NESTED: FakeMap = {
  select: {
    id: true,
    posts: { take: 2, select: { id: true, comments: { select: { id: true } } } },
  },
};

describe('treeAccumulator', () => {
  /**
   * The classifier is a visitor, not a parse: one visitor per accumulator, re-used down the tree
   * by saving and restoring its cursor, so a merge allocates only what the format's own key loop
   * already allocated.
   */
  it('reads every level of a merge with one visitor, and reuses it across merges', () => {
    const { format, visitors } = recordingFormat();
    const accumulator = treeAccumulator(format);
    const node = accumulator.create(models.User);

    accumulator.merge(node, NESTED);

    // Three levels deep, one visitor.
    expect(visitors.length).toBe(3);
    expect(new Set(visitors).size).toBe(1);

    const [merger] = visitors;

    accumulator.merge(accumulator.create(models.User), NESTED);

    expect(new Set(visitors).size).toBe(1);
    expect(visitors[3]).toBe(merger);
  });

  it('reads every level of a check with one visitor, and a different one from the merge', () => {
    const { format, visitors } = recordingFormat();
    const accumulator = treeAccumulator(format);
    const node = accumulator.create(models.User);

    accumulator.merge(node, NESTED);

    const merger = visitors[0];

    visitors.length = 0;
    expect(accumulator.accepts!(node, NESTED)).toBe(true);

    // Every level, because every relation is already on the node.
    expect(visitors.length).toBe(3);
    expect(new Set(visitors).size).toBe(1);
    expect(visitors[0]).not.toBe(merger);
  });

  it('leaves a conflicting relation out of a lenient merge and keeps the rest (E-2)', () => {
    const accumulator = treeAccumulator(createFakeFormat());
    const node = accumulator.create(models.User);

    accumulator.merge(node, { select: { posts: { take: 2, select: { id: true } } } });
    accumulator.merge(
      node,
      { select: { id: true, posts: { take: 5, select: { id: true } } } },
      { lenient: true },
    );

    expect(accumulator.emit(node)).toEqual({
      select: { id: true, posts: { take: 2, select: { id: true } } },
    });
  });

  it('adds no columns for a relation query without a selection of its own (E-3)', () => {
    const accumulator = treeAccumulator(createFakeFormat());
    const node = accumulator.create(models.User);

    accumulator.merge(node, { take: 2 }, { asQuery: true });

    expect(node.columns).toEqual(new Set());
    expect(accumulator.emit(node)).toEqual({ take: 2, select: {} });
  });

  it('absorbs a node without serializing it', () => {
    const accumulator = treeAccumulator(createFakeFormat());
    const into = accumulator.create(models.User);
    const from = accumulator.create(models.User);

    accumulator.merge(into, { select: { id: true } });
    accumulator.merge(from, NESTED);

    expect(accumulator.acceptsFrom!(into, from)).toBe(true);
    accumulator.absorb!(into, from);

    expect(accumulator.emit(into)).toEqual(accumulator.emit(from));
  });
});
