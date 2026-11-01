import type { GraphQLResolveInfo } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  cacheKey,
  getLoaderMapping,
  type Mapping,
  responsePath,
  setFieldMapping,
  setLoaderMappings,
  setRowFieldMapping,
  setRowMappings,
} from '../src/loader-map.js';

type Path = GraphQLResolveInfo['path'];
function pathOf(...keys: (string | number)[]): Path {
  let path: Path | undefined;
  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }
  return path!;
}
function child(prev: Path, ...keys: (string | number)[]): Path {
  let path = prev;
  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }
  return path;
}
function info(path: Path, type = 'User') {
  return { parentType: { name: type }, path } as GraphQLResolveInfo;
}

describe('loader map', () => {
  it('shares plan keys across list rows', () => {
    expect(responsePath(pathOf('user', 'posts', 0, 'author'))).toBe('user.posts.author');
    expect(responsePath(undefined)).toBe('');
    expect(cacheKey('Post', pathOf('user', 'posts', 3))).toBe('Post@user.posts');
  });

  it('records a plan beneath its concrete root, including connection wrappers', () => {
    const ctx = {};
    const root = pathOf('user', 'posts');
    const author: Mapping = { nested: {} };
    const comments: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), {
      'Post@nodes.author': author,
      'Post@edges.node.comments': comments,
    });
    expect(getLoaderMapping(ctx, child(root, 'nodes', 1, 'author'), 'Post')).toBe(author);
    expect(getLoaderMapping(ctx, child(root, 'edges', 0, 'node', 'comments'), 'Post')).toBe(
      comments,
    );
    expect(getLoaderMapping(ctx, child(root, 'nodes', 1, 'author'), 'User')).toBe(null);
    expect(getLoaderMapping({}, child(root, 'nodes', 1, 'author'), 'Post')).toBe(null);
  });

  it('retains different model plans contributing to one Relay nodes list', () => {
    const ctx = {};
    const root = pathOf('nodes');
    const userPosts: Mapping = { nested: {} };
    const postAuthor: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root, 'Query'), { 'User@posts': userPosts });
    setLoaderMappings(ctx, info(root, 'Query'), { 'Post@author': postAuthor });
    expect(getLoaderMapping(ctx, child(root, 0, 'posts'), 'User')).toBe(userPosts);
    expect(getLoaderMapping(ctx, child(root, 1, 'author'), 'Post')).toBe(postAuthor);
  });

  it('keeps fallback descendants isolated from planned siblings through lists and wrappers', () => {
    const ctx = {};
    const root = pathOf('users');
    const planned: Mapping = { nested: {} };
    const loaded: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), { 'Post@posts.edges.node.author': planned });
    const fallback = child(root, 0, 'posts');
    setRowMappings(ctx, info(fallback), { 'Post@edges.node.author': loaded });
    expect(getLoaderMapping(ctx, child(fallback, 'edges', 2, 'node', 'author'), 'Post', {})).toBe(
      loaded,
    );
    expect(
      getLoaderMapping(ctx, child(root, 1, 'posts', 'edges', 2, 'node', 'author'), 'Post', {}),
    ).toBe(planned);
  });

  it('does not infer loaded fields from another plan when the fallback omitted them', () => {
    const ctx = {};
    const root = pathOf('users');
    const planned: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), { 'Post@posts.author': planned });
    const fallback = child(root, 0, 'posts');
    setRowMappings(ctx, info(fallback), {});
    expect(getLoaderMapping(ctx, child(fallback, 0, 'author'), 'Post')).toBe(null);
    expect(getLoaderMapping(ctx, child(root, 1, 'posts', 0, 'author'), 'Post')).toBe(planned);
  });

  it('lets a nested query establish a new plan beneath an inherited empty scope', () => {
    const ctx = {};
    const root = pathOf('users');
    setRowMappings(ctx, info(root), {});
    const posts = child(root, 0, 'posts');
    const author: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(posts), { 'Post@author': author });
    expect(getLoaderMapping(ctx, child(posts, 0, 'author'), 'Post')).toBe(author);
    expect(getLoaderMapping(ctx, child(root, 1, 'posts', 0, 'author'), 'Post')).toBe(null);
  });

  it('records a fallback field only for its loaded parent, while its children use its scope', () => {
    const ctx = {};
    const field = pathOf('users', 0, 'posts');
    const row = {};
    const author: Mapping = { nested: {} };
    const loaded: Mapping = { nested: { 'Post@author': author } };
    setRowFieldMapping(ctx, info(field), loaded, row);
    expect(getLoaderMapping(ctx, field, 'User', row)).toBe(loaded);
    expect(getLoaderMapping(ctx, field, 'User', {})).toBe(null);
    expect(getLoaderMapping(ctx, child(field, 2, 'author'), 'Post', {})).toBe(author);
  });

  it('isolates aliases and occurrences even when a resolver reuses the same parent object', () => {
    const ctx = {};
    const root = pathOf('users');
    const row = {};
    const planned: Mapping = { nested: {} };
    const loaded: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), { 'User@posts': planned, 'User@other': planned });
    const field = child(root, 0, 'posts');
    setRowFieldMapping(ctx, info(field), loaded, row);
    expect(getLoaderMapping(ctx, field, 'User', row)).toBe(loaded);
    expect(getLoaderMapping(ctx, child(root, 1, 'posts'), 'User', row)).toBe(planned);
    expect(getLoaderMapping(ctx, child(root, 0, 'other'), 'User', row)).toBe(planned);
  });

  it('does not retain a row override across executions reusing the context and parent', () => {
    const ctx = {};
    const row = {};
    const first = pathOf('users');
    const field = child(first, 0, 'posts');
    const loaded: Mapping = { nested: {} };
    setRowFieldMapping(ctx, info(field), loaded, row);
    const next = pathOf('users');
    const planned: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(next), { 'User@posts': planned });
    expect(getLoaderMapping(ctx, child(next, 0, 'posts'), 'User', row)).toBe(planned);
  });

  it('does not give agreeing rows an override of their shared field mapping', () => {
    const ctx = {};
    const root = pathOf('users');
    const planned: Mapping = { nested: {} };
    const replanned: Mapping = { nested: {} };
    setLoaderMappings(ctx, info(root), { 'User@posts': planned });
    const rows = [{}, {}, {}];
    const paths = rows.map((_, i) => child(root, i, 'posts'));
    rows.forEach((row, i) => {
      setFieldMapping(ctx, info(paths[i]), planned, row);
    });
    setLoaderMappings(ctx, info(root), { 'User@posts': replanned });
    rows.forEach((row, i) => {
      expect(getLoaderMapping(ctx, paths[i], 'User', row)).toBe(replanned);
    });
  });
});
