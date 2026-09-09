import type { GraphQLResolveInfo } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  cacheKey,
  getLoaderMapping,
  type Mapping,
  responsePath,
  setFieldMapping,
  setLoaderMappings,
} from '../src/loader-map.js';

type Path = GraphQLResolveInfo['path'];

function pathOf(...keys: (string | number)[]): Path {
  let path: Path | undefined;

  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }

  return path!;
}

function infoAt(parentType: string, ...keys: (string | number)[]) {
  return { parentType: { name: parentType }, path: pathOf(...keys) } as GraphQLResolveInfo;
}

describe('loader map', () => {
  it('joins the string keys of a response path and drops list indices', () => {
    expect(responsePath(pathOf('user', 'posts', 0, 'author'))).toBe('user.posts.author');
    expect(responsePath(undefined)).toBe('');
    expect(cacheKey('Post', pathOf('user', 'posts', 3))).toBe('Post@user.posts');
  });

  it('records mappings under the walked field, keyed by type and full relative path (L-1)', () => {
    const ctx = {};
    const author: Mapping = { nested: {} };
    const comments: Mapping = { nested: {} };

    setLoaderMappings(ctx, infoAt('Query', 'user', 'posts'), {
      'Post@nodes.author': author,
      'Post@edges.node.comments': comments,
    });

    expect(getLoaderMapping(ctx, pathOf('user', 'posts', 'nodes', 1, 'author'), 'Post')).toBe(
      author,
    );
    expect(
      getLoaderMapping(ctx, pathOf('user', 'posts', 'edges', 0, 'node', 'comments'), 'Post'),
    ).toBe(comments);
    expect(getLoaderMapping(ctx, pathOf('user', 'posts', 'nodes', 1, 'author'), 'User')).toBe(null);
  });

  it('keeps mappings per context', () => {
    const mapping: Mapping = { nested: {} };

    setLoaderMappings({}, infoAt('Query', 'user'), { 'User@posts': mapping });

    expect(getLoaderMapping({}, pathOf('user', 'posts'), 'User')).toBe(null);
  });

  it("records a field's own mapping under its parent type along with its children", () => {
    const ctx = {};
    const author: Mapping = { nested: {} };
    const posts: Mapping = { nested: { 'Post@author': author }, extra: ['User.posts'] };

    setFieldMapping(ctx, infoAt('User', 'user', 'posts'), posts);

    expect(getLoaderMapping(ctx, pathOf('user', 'posts'), 'User')).toBe(posts);
    expect(getLoaderMapping(ctx, pathOf('user', 'posts', 2, 'author'), 'Post')).toBe(author);
  });
});
