import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import { vi } from 'vitest';
import DataloaderPlugin from '../src';

describe('nested list output', () => {
  it('loads ids nested inside a list of lists', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    const load = vi.fn(async (ids: number[]) => ids.map((id) => ({ id })));

    const User = builder.loadableObject('User', {
      load,
      fields: (t) => ({ id: t.exposeInt('id', { nullable: false }) }),
    });

    builder.queryType({
      fields: (t) => ({
        matrix: t.field({
          type: t.listRef(t.listRef(User)),
          resolve: () => [[1, 2], [3]],
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ matrix { id } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ matrix: [[{ id: 1 }, { id: 2 }], [{ id: 3 }]] });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0][0]).toEqual([1, 2, 3]);
  });

  it('loads ids nested inside iterables of iterables', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    const User = builder.loadableObject('User', {
      load: async (ids: number[]) => ids.map((id) => ({ id })),
      fields: (t) => ({ id: t.exposeInt('id', { nullable: false }) }),
    });

    builder.queryType({
      fields: (t) => ({
        matrix: t.field({
          type: t.listRef(t.listRef(User)),
          resolve: () => Promise.resolve(new Set([new Set([1, 2]), new Set([3])])),
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ matrix { id } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ matrix: [[{ id: 1 }, { id: 2 }], [{ id: 3 }]] });
  });

  it('reports an Error returned for a nullable inner list at its own path', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    const User = builder.loadableObject('User', {
      load: async (ids: number[]) => ids.map((id) => ({ id })),
      fields: (t) => ({ id: t.exposeInt('id', { nullable: false }) }),
    });

    builder.queryType({
      fields: (t) => ({
        matrix: t.field({
          type: t.listRef(t.listRef(User), { nullable: true }),
          resolve: () => [[{ id: 1 }], new Error('row failed')] as never,
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ matrix { id } }',
      contextValue: {},
    });

    expect(result.data).toEqual({ matrix: [[{ id: 1 }], null] });
    expect(result.errors?.map((error) => error.message)).toEqual(['row failed']);
    expect(result.errors?.[0].path).toEqual(['matrix', 1]);
  });

  it('reports an Error returned for a nullable list item at its own path', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    const User = builder.loadableObject('User', {
      load: async (ids: number[]) => ids.map((id) => ({ id })),
      fields: (t) => ({ id: t.exposeInt('id', { nullable: false }) }),
    });

    builder.queryType({
      fields: (t) => ({
        users: t.field({
          type: t.listRef(User, { nullable: true }),
          resolve: () => [{ id: 1 }, new Error('user failed')] as never,
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ users { id } }',
      contextValue: {},
    });

    expect(result.data).toEqual({ users: [{ id: 1 }, null] });
    expect(result.errors?.map((error) => error.message)).toEqual(['user failed']);
    expect(result.errors?.[0].path).toEqual(['users', 1]);
  });
});

describe('iterable resolver results', () => {
  it('loads ids from an iterable returned by a list field of loadable objects', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    const User = builder.loadableObject('User', {
      load: async (ids: number[]) => ids.map((id) => ({ id })),
      fields: (t) => ({ id: t.exposeInt('id', { nullable: false }) }),
    });

    builder.queryType({
      fields: (t) => ({
        users: t.field({
          type: [User],
          resolve: () => new Set([1, 2]),
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ users { id } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ id: 1 }, { id: 2 }] });
  });

  it('loads ids from a promise of an iterable', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    const User = builder.loadableObject('User', {
      load: async (ids: number[]) => ids.map((id) => ({ id })),
      fields: (t) => ({ id: t.exposeInt('id', { nullable: false }) }),
    });

    builder.queryType({
      fields: (t) => ({
        users: t.field({
          type: [User],
          resolve: () => Promise.resolve(new Set([1, 2])),
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ users { id } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ id: 1 }, { id: 2 }] });
  });

  it('accepts an iterable of keys from a t.loadable list field', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    builder.queryType({
      fields: (t) => ({
        numbers: t.loadable({
          type: ['Int'],
          nullable: false,
          load: async (ids: number[]) => ids,
          resolve: () => new Set([1, 2]),
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ numbers }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ numbers: [1, 2] });
  });

  it('still supports an iterable of already loaded objects', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    const User = builder
      .objectRef<{ id: number }>('User')
      .implement({ fields: (t) => ({ id: t.exposeInt('id', { nullable: false }) }) });

    builder.queryType({
      fields: (t) => ({
        users: t.field({
          type: [User],
          resolve: () => new Set([{ id: 1 }, { id: 2 }]),
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ users { id } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ id: 1 }, { id: 2 }] });
  });
});

describe('loadableUnion extensions', () => {
  it('preserves extensions passed by the caller', () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [DataloaderPlugin] });

    const User = builder
      .objectRef<{ id: number }>('User')
      .implement({ fields: (t) => ({ id: t.exposeInt('id', { nullable: false }) }) });

    const Result = builder.loadableUnion('Result', {
      types: [User],
      resolveType: () => User,
      load: async (ids: number[]) => ids.map((id) => ({ id })),
      extensions: { reviewMarker: 'preserved' },
    });

    builder.queryType({
      fields: (t) => ({
        result: t.field({ type: Result, nullable: false, resolve: () => 1 }),
      }),
    });

    const type = builder.toSchema().getType('Result')!;

    expect(type.extensions.reviewMarker).toBe('preserved');
    expect(type.extensions.getDataloader).toBeTypeOf('function');
  });
});
