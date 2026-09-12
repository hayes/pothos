import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import DataloaderPlugin from '../src';

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
