import type { GraphQLResolveInfo } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  cacheKey,
  getLoaderMapping,
  type Mapping,
  responsePath,
  setFieldMapping,
  setLoaderMappings,
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
    const row = {};
    const author: Mapping = { nested: {} };
    const posts: Mapping = { nested: { 'Post@author': author } };

    setFieldMapping(ctx, infoAt('User', 'user', 'posts'), posts, row);

    expect(getLoaderMapping(ctx, pathOf('user', 'posts'), 'User', row)).toBe(posts);
    expect(getLoaderMapping(ctx, pathOf('user', 'posts', 2, 'author'), 'Post', row)).toBe(author);
    // Nothing else has claimed the keys, so the rows that ask without one still find them.
    expect(getLoaderMapping(ctx, pathOf('user', 'posts'), 'User')).toBe(posts);
  });

  it('answers a row from the mapping recorded for it, over the plan for the field', () => {
    const ctx = {};
    const info = infoAt('User', 'users', 'posts');
    const planned: Mapping = { nested: {} };
    const loaded: Mapping = { nested: {} };
    const plannedRow = {};
    const loadedRow = {};

    setLoaderMappings(ctx, infoAt('Query', 'users'), { 'User@posts': planned });
    setFieldMapping(ctx, info, loaded, loadedRow);

    expect(getLoaderMapping(ctx, info.path, 'User', loadedRow)).toBe(loaded);
    expect(getLoaderMapping(ctx, info.path, 'User', plannedRow)).toBe(planned);
    expect(getLoaderMapping(ctx, info.path, 'User')).toBe(planned);
  });

  it("does not let one row's mappings displace the plan's beneath it", () => {
    const ctx = {};
    const planned: Mapping = { nested: {} };
    const loaded: Mapping = { nested: {} };
    const row = {};

    setLoaderMappings(ctx, infoAt('Query', 'users'), { 'Post@posts.author': planned });
    setRowMappings(ctx, infoAt('User', 'users', 'posts'), { 'Post@author': loaded }, row);

    expect(getLoaderMapping(ctx, pathOf('users', 1, 'posts', 0, 'author'), 'Post', row)).toBe(
      loaded,
    );
    expect(getLoaderMapping(ctx, pathOf('users', 1, 'posts', 0, 'author'), 'Post')).toBe(planned);
  });

  it('records nothing per row while the rows of a list agree', () => {
    const ctx = {};
    const info = infoAt('User', 'users', 'posts');
    const planned: Mapping = { nested: { 'Post@author': { nested: {} } } };
    const rows = [{}, {}, {}, {}];

    setLoaderMappings(ctx, infoAt('Query', 'users'), { 'User@posts': planned });

    // What every row of the list is handed: the mapping already at its key.
    for (const row of rows) {
      setFieldMapping(ctx, info, planned, row);
    }

    expect(getLoaderMapping(ctx, info.path, 'User', {})).toBe(planned);
    expect(getLoaderMapping(ctx, info.path, 'User')).toBe(planned);
    for (const row of rows) {
      expect(getLoaderMapping(ctx, info.path, 'User', row)).toBe(planned);
    }

    // Not one of them claimed a mapping of its own: replanning the field moves all of them at
    // once. A row holding a mapping of its own would keep reading the mapping it claimed.
    const replanned: Mapping = { nested: {} };

    setLoaderMappings(ctx, infoAt('Query', 'users'), { 'User@posts': replanned });

    for (const row of rows) {
      expect(getLoaderMapping(ctx, info.path, 'User', row)).toBe(replanned);
    }
  });

  it('records against no row when there is none to hang a mapping off', () => {
    const ctx = {};
    const mapping: Mapping = { nested: {} };

    setRowMappings(ctx, infoAt('User', 'user', 'posts'), { 'Post@author': mapping }, undefined);

    expect(getLoaderMapping(ctx, pathOf('user', 'posts', 'author'), 'Post')).toBe(mapping);
  });
});
