import { GraphQLError } from 'graphql';
import { describe, expectTypeOf, it } from 'vitest';
import builder from './example/builder';

interface User {
  id: number;
}

// Regression tests for #951: when `load` resolves to `Shape | Error`, the object
// `Shape` must be inferred with `Error` excluded from the union, so dependent
// callbacks (`toKey`, `sort`, `cacheResolved`) receive the resolved `Shape` only.
describe('dataloader Shape inference (#951)', () => {
  it('loadableObject infers Shape with Error excluded', () => {
    builder.loadableObject('ObjectShape951', {
      load: async (ids: string[]) =>
        ids.map((id) => (Number(id) > 0 ? { id: Number(id) } : new GraphQLError('bad'))),
      fields: () => ({}),
      toKey: (value) => {
        expectTypeOf(value).toEqualTypeOf<User>();
        return String(value.id);
      },
    });
  });

  it('loadableObjectRef infers Shape with Error excluded', () => {
    builder.loadableObjectRef('ObjectRefShape951', {
      load: async (ids: string[]) =>
        ids.map((id) => (Number(id) > 0 ? { id: Number(id) } : new GraphQLError('bad'))),
      toKey: (value) => {
        expectTypeOf(value).toEqualTypeOf<User>();
        return String(value.id);
      },
    });
  });

  it('loadableInterfaceRef infers Shape with Error excluded', () => {
    builder.loadableInterfaceRef('InterfaceRefShape951', {
      load: async (ids: string[]) =>
        ids.map((id) => (Number(id) > 0 ? { id: Number(id) } : new GraphQLError('bad'))),
      toKey: (value) => {
        expectTypeOf(value).toEqualTypeOf<User>();
        return String(value.id);
      },
    });
  });

  it('loadableNodeRef infers Shape with Error excluded', () => {
    builder.loadableNodeRef('NodeRefShape951', {
      id: { resolve: (value) => value.id },
      load: async (ids: string[]) =>
        ids.map((id) => (Number(id) > 0 ? { id: Number(id) } : new GraphQLError('bad'))),
      toKey: (value) => {
        expectTypeOf(value).toEqualTypeOf<User>();
        return String(value.id);
      },
    });
  });
});
