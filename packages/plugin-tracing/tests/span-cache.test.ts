import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import TracingPlugin, { createSpanWithParent } from '../src';

describe('span cache', () => {
  it('does not inherit a parent span from an untraced field with an Object.prototype alias', async () => {
    const parents: unknown[] = [];

    const builder = new SchemaBuilder({
      plugins: [TracingPlugin],
      tracing: {
        default: true,
        wrap: (resolver) => (source, args, ctx, info) => {
          createSpanWithParent(ctx as object, info, (_path, parent) => {
            parents.push(parent);

            return { span: true };
          });

          return resolver(source, args, ctx, info);
        },
      },
    });

    const Obj = builder.objectRef<{}>('Obj').implement({
      fields: (t) => ({
        value: t.string({ resolve: () => 'ok' }),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        seed: t.string({ resolve: () => 'seed' }),
        obj: t.field({ type: Obj, tracing: false, resolve: () => ({}) }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ seed constructor: obj { value } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(parents).toEqual([null, null]);
  });

  it('still inherits the span of a traced ancestor', async () => {
    const parents: unknown[] = [];

    const builder = new SchemaBuilder({
      plugins: [TracingPlugin],
      tracing: {
        default: true,
        wrap: (resolver) => (source, args, ctx, info) => {
          createSpanWithParent(ctx as object, info, (path, parent) => {
            parents.push(parent);

            return { path };
          });

          return resolver(source, args, ctx, info);
        },
      },
    });

    const Obj = builder.objectRef<{}>('Obj').implement({
      fields: (t) => ({
        value: t.string({ resolve: () => 'ok' }),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        obj: t.field({ type: Obj, resolve: () => ({}) }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ constructor: obj { value } }',
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(parents).toEqual([null, { path: 'constructor' }]);
  });
});
