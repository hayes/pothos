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

// The `builder.*Ref` methods are intended to keep working with explicit type
// params. Passing `<Shape, Key>` (Shape first, Key second) must resolve
// `Shape`/`Key` exactly as before the #951 fix, without requiring callers to
// refactor explicit-generic call sites.
describe('dataloader ref explicit generics (backwards compatibility)', () => {
  it('loadableObjectRef<User, string> resolves Shape=User, Key=string', () => {
    builder.loadableObjectRef<User, string>('ObjectRefExplicit', {
      load: (keys) => {
        expectTypeOf(keys).toEqualTypeOf<string[]>();
        return Promise.resolve(keys.map((id) => ({ id: Number(id) })));
      },
      toKey: (value) => {
        expectTypeOf(value).toEqualTypeOf<User>();
        return String(value.id);
      },
    });
  });

  it('loadableInterfaceRef<User, string> resolves Shape=User, Key=string', () => {
    builder.loadableInterfaceRef<User, string>('InterfaceRefExplicit', {
      load: (keys) => {
        expectTypeOf(keys).toEqualTypeOf<string[]>();
        return Promise.resolve(keys.map((id) => ({ id: Number(id) })));
      },
      toKey: (value) => {
        expectTypeOf(value).toEqualTypeOf<User>();
        return String(value.id);
      },
    });
  });

  it('loadableNodeRef<User, string> resolves Shape=User, Key=string', () => {
    builder.loadableNodeRef<User, string>('NodeRefExplicit', {
      id: {
        resolve: (value) => {
          expectTypeOf(value).toEqualTypeOf<User>();
          return value.id;
        },
      },
      load: (keys) => {
        expectTypeOf(keys).toEqualTypeOf<string[]>();
        return Promise.resolve(keys.map((id) => ({ id: Number(id) })));
      },
      toKey: (value) => {
        expectTypeOf(value).toEqualTypeOf<User>();
        return String(value.id);
      },
    });
  });
});
