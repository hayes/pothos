import { describe, expect, it } from 'vitest';
import { createNode, relation } from '../src';
import { createModels } from './fake-adapter';

describe('node', () => {
  const models = createModels('User', 'Post');

  it('starts in named-column mode with no relations', () => {
    const node = createNode(models.User);

    expect(node.columns).toEqual(new Set());
    expect(node.relations.size).toBe(0);
    expect(node.extras.size).toBe(0);
    expect(node.args).toEqual({});
  });

  it('creates a relation node once and returns it afterwards', () => {
    const node = createNode(models.User);
    const posts = relation(node, 'posts', models.Post, {});

    expect(posts.model).toBe(models.Post);
    expect(relation(node, 'posts', models.Post, true)).toBe(posts);
    expect([...node.relations.keys()]).toEqual(['posts']);
  });

  it('rejects a promise as a relation value (A-6)', () => {
    const node = createNode(models.User);

    expect(() => relation(node, 'posts', models.Post, Promise.resolve({}))).toThrow(
      'Relation "posts" was given a promise. Await nestedSelection()',
    );
    expect(node.relations.size).toBe(0);
  });
});
