// What the table-name and ref forms of the field methods infer for `t`, the parent and the
// connection query. Their defaults are computed per key (so completing a name stays cheap); these
// pin that each form still infers the table and shape it names.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import WithInputPlugin from '@pothos/plugin-with-input';
import type { BuildQueryResult, TableRelationalConfig } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin, {
  type DrizzleObjectFieldBuilder,
  type DrizzleRef,
  type DrizzleTableNameBrand,
  drizzleConnectionHelpers,
} from '../src';
import { type DrizzleRelations, db, relations } from './example/db';
import type { posts, users } from './example/db/schema';

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, WithInputPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

type Types = typeof builder.$inferSchemaTypes;
type UserRow = typeof users.$inferSelect;
type PostRow = typeof posts.$inferSelect;

/** The table config and parent shape a field builder was created with. */
type BuilderOf<T> =
  // biome-ignore lint/suspicious/noExplicitAny: matches any schema types and exposable shape
  T extends DrizzleObjectFieldBuilder<any, infer TableConfig, infer Shape, any>
    ? { table: TableConfig; shape: Shape }
    : never;

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({ id: t.exposeID('id') }),
});

const UserIds = builder.drizzleObject('users', {
  variant: 'UserIds',
  select: { columns: { id: true } },
  fields: (t) => ({ userId: t.exposeID('id') }),
});

const UserWithPosts = builder.drizzleObject('users', {
  variant: 'UserWithPosts',
  select: { columns: { username: true }, with: { posts: { columns: { title: true } } } },
  fields: (t) => ({ name: t.exposeString('username') }),
});

const UserNode = builder.drizzleNode('users', {
  variant: 'UserNode',
  id: { column: (user) => user.id },
  fields: (t) => ({ name: t.exposeString('username') }),
});

const Post = builder.drizzleInterface('posts', {
  name: 'Post',
  fields: (t) => ({ title: t.exposeString('title') }),
});

const PostTitle = builder.drizzleInterface('posts', {
  variant: 'PostTitle',
  select: { columns: { title: true } },
  fields: (t) => ({ title: t.exposeString('title') }),
});

type UserIdsShape = { id: number };
type UserWithPostsShape = { username: string; posts: { title: string }[] };

it('infers the table and shape of drizzleObjectField(s) from a table name', () => {
  builder.drizzleObjectField('users', 'a', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['users'];
      shape: UserRow & DrizzleTableNameBrand<'users'>;
    }>();

    return t.string({
      resolve: (user) => {
        expectTypeOf(user).toEqualTypeOf<UserRow>();
        return user.username;
      },
    });
  });

  builder.drizzleObjectFields('users', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['users'];
      shape: UserRow & DrizzleTableNameBrand<'users'>;
    }>();

    return {};
  });
});

it('infers the table and shape of drizzleObjectField(s) from a ref', () => {
  builder.drizzleObjectField(User, 'b', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['users'];
      shape: UserRow & DrizzleTableNameBrand<'users'>;
    }>();

    return t.exposeString('username');
  });

  builder.drizzleObjectFields(UserIds, (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['users'];
      shape: UserIdsShape & DrizzleTableNameBrand<'users'>;
    }>();

    return {
      c: t.string({
        resolve: (user) => {
          expectTypeOf(user).toEqualTypeOf<UserIdsShape>();
          return String(user.id);
        },
      }),
    };
  });

  builder.drizzleObjectField(UserWithPosts, 'd', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['users'];
      shape: UserWithPostsShape & DrizzleTableNameBrand<'users'>;
    }>();

    return t.int({ resolve: (user) => user.posts.length });
  });

  builder.drizzleObjectFields(UserNode, (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['users'];
      shape: UserRow & DrizzleTableNameBrand<'users'>;
    }>();

    return {};
  });
});

it('infers the table and shape of drizzleInterfaceField(s) from a table name or a ref', () => {
  builder.drizzleInterfaceField('posts', 'e', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['posts'];
      shape: PostRow & DrizzleTableNameBrand<'posts'>;
    }>();

    return t.exposeString('title');
  });

  builder.drizzleInterfaceFields(Post, (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['posts'];
      shape: PostRow & DrizzleTableNameBrand<'posts'>;
    }>();

    return {};
  });

  builder.drizzleInterfaceField(PostTitle, 'f', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['posts'];
      shape: { title: string } & DrizzleTableNameBrand<'posts'>;
    }>();

    return t.exposeString('title');
  });
});

it('keeps explicit type arguments', () => {
  builder.drizzleObjectField<'users'>('users', 'g', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['users'];
      shape: UserRow & DrizzleTableNameBrand<'users'>;
    }>();

    return t.exposeString('username');
  });

  builder.drizzleObjectFields<typeof UserIds>(UserIds, (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['users'];
      shape: UserIdsShape & DrizzleTableNameBrand<'users'>;
    }>();

    return {};
  });
});

it('reads the parent shape from an explicit table config', () => {
  builder.drizzleObjectField<'users', DrizzleRelations['posts']>('users', 'h', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['posts'];
      shape: PostRow & DrizzleTableNameBrand<'users'>;
    }>();

    return t.string({ resolve: (post) => post.title });
  });

  builder.drizzleObjectFields<'users', DrizzleRelations['posts']>('users', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['posts'];
      shape: PostRow & DrizzleTableNameBrand<'users'>;
    }>();

    return { i: t.string({ resolve: (post) => post.title }) };
  });

  builder.drizzleInterfaceField<'users', DrizzleRelations['posts']>('users', 'j', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['posts'];
      shape: PostRow & DrizzleTableNameBrand<'users'>;
    }>();

    return t.string({ resolve: (post) => post.title });
  });

  builder.drizzleInterfaceFields<'users', DrizzleRelations['posts']>('users', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: DrizzleRelations['posts'];
      shape: PostRow & DrizzleTableNameBrand<'users'>;
    }>();

    return { k: t.string({ resolve: (post) => post.title }) };
  });

  builder.drizzleObjectFields<'users', TableRelationalConfig>('users', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: TableRelationalConfig;
      shape: BuildQueryResult<DrizzleRelations, TableRelationalConfig, true> &
        DrizzleTableNameBrand<'users'>;
    }>();

    return { l: t.string({ resolve: (row) => String(row.anything) }) };
  });

  const postPages = drizzleConnectionHelpers<Types, 'users', true, DrizzleRelations['posts']>(
    builder,
    'users',
    {},
  );

  expectTypeOf<Parameters<typeof postPages.resolve>[0]>().toEqualTypeOf<PostRow[]>();
});

it('reads an explicit table config that is only like the default as before', () => {
  // biome-ignore lint/suspicious/noExplicitAny: an explicit config with an `any` part
  type UsersAnyTable = Omit<DrizzleRelations['users'], 'table'> & { table: any };
  // biome-ignore lint/suspicious/noExplicitAny: the parent shape main infers for an `any` config
  type AnyShape = BuildQueryResult<DrizzleRelations, any, true> & DrizzleTableNameBrand<'users'>;
  type AnyTableShape = BuildQueryResult<DrizzleRelations, UsersAnyTable, true> &
    DrizzleTableNameBrand<'users'>;

  // biome-ignore lint/suspicious/noExplicitAny: an explicit `any` config
  builder.drizzleObjectField<'users', any>('users', 'o1', (t) => {
    // biome-ignore lint/suspicious/noExplicitAny: the table config given
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{ table: any; shape: AnyShape }>();

    return t.string({ resolve: (row) => String(row.anything) });
  });
  // biome-ignore lint/suspicious/noExplicitAny: an explicit `any` config
  builder.drizzleObjectFields<'users', any>('users', (t) => {
    // biome-ignore lint/suspicious/noExplicitAny: the table config given
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{ table: any; shape: AnyShape }>();

    return { o2: t.string({ resolve: (row) => String(row.anything) }) };
  });
  // biome-ignore lint/suspicious/noExplicitAny: an explicit `any` config
  builder.drizzleInterfaceField<'users', any>('users', 'o3', (t) => {
    // biome-ignore lint/suspicious/noExplicitAny: the table config given
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{ table: any; shape: AnyShape }>();

    return t.string({ resolve: (row) => String(row.anything) });
  });
  // biome-ignore lint/suspicious/noExplicitAny: an explicit `any` config
  builder.drizzleInterfaceFields<'users', any>('users', (t) => {
    // biome-ignore lint/suspicious/noExplicitAny: the table config given
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{ table: any; shape: AnyShape }>();

    return { o4: t.string({ resolve: (row) => String(row.anything) }) };
  });

  builder.drizzleObjectField<'users', UsersAnyTable>('users', 'o5', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: UsersAnyTable;
      shape: AnyTableShape;
    }>();

    return t.string({ resolve: () => '' });
  });
  builder.drizzleObjectFields<'users', UsersAnyTable>('users', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: UsersAnyTable;
      shape: AnyTableShape;
    }>();

    return {};
  });
  builder.drizzleInterfaceField<'users', UsersAnyTable>('users', 'o6', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: UsersAnyTable;
      shape: AnyTableShape;
    }>();

    return t.string({ resolve: () => '' });
  });
  builder.drizzleInterfaceFields<'users', UsersAnyTable>('users', (t) => {
    expectTypeOf<BuilderOf<typeof t>>().toEqualTypeOf<{
      table: UsersAnyTable;
      shape: AnyTableShape;
    }>();

    return {};
  });
});

it('reads a union of table names against all of their tables', () => {
  const tables = ['users', 'posts'] as const;
  type Tables = DrizzleRelations['users'] | DrizzleRelations['posts'];

  for (const table of tables) {
    builder.drizzleObjectFields(table, (t) => {
      expectTypeOf<BuilderOf<typeof t>['table']>().toEqualTypeOf<Tables>();

      return {
        m: t.string({
          resolve: (row) => {
            expectTypeOf(row).toEqualTypeOf<{}>();
            return table;
          },
        }),
      };
    });
    builder.drizzleInterfaceField(table, 'n', (t) => {
      expectTypeOf<BuilderOf<typeof t>['table']>().toEqualTypeOf<Tables>();

      return t.string({ resolve: () => table });
    });
  }

  const userOrPostPages = drizzleConnectionHelpers(builder, tables[0] as 'users' | 'posts', {});
  const userWithPostsOrPostPages = drizzleConnectionHelpers(
    builder,
    UserWithPosts as typeof UserWithPosts | 'posts',
    {},
  );

  expectTypeOf<Parameters<typeof userOrPostPages.resolve>[0][number]>().toEqualTypeOf<
    BuildQueryResult<DrizzleRelations, Tables, true>
  >();
  expectTypeOf<Parameters<typeof userWithPostsOrPostPages.resolve>[0][number]>().toEqualTypeOf<
    UserWithPostsShape | BuildQueryResult<DrizzleRelations, Tables, true>
  >();

  return (rows: UserRow[], ctx: object) => userWithPostsOrPostPages.resolve(rows, {}, ctx);
});

it('accepts a table name typed by a type parameter', () => {
  function addLabel<Table extends 'users' | 'posts'>(table: Table) {
    builder.drizzleObjectField(table, 'label', (t) => t.string({ resolve: () => table }));
    builder.drizzleObjectFields(table, (t) => ({
      label2: t.string({ resolve: () => table }),
    }));
  }

  addLabel('users');
});

type UserOrderBy = {
  id?: 'asc' | 'desc' | undefined;
  username?: 'asc' | 'desc' | undefined;
  firstName?: 'asc' | 'desc' | undefined;
  lastName?: 'asc' | 'desc' | undefined;
};

it('types the drizzleConnection query by the table a name or a ref gives', () => {
  builder.queryFields((t) => ({
    byName: t.drizzleConnection({
      type: 'users',
      resolve: (query, parent) => {
        expectTypeOf(query().orderBy).toEqualTypeOf<UserOrderBy>();
        expectTypeOf(parent).toEqualTypeOf<{}>();

        return db.query.users.findMany(query());
      },
    }),
    byRef: t.drizzleConnection({
      type: UserIds,
      resolve: (query) => {
        expectTypeOf(query().orderBy).toEqualTypeOf<UserOrderBy>();

        return db.query.users.findMany(query({ columns: { id: true } }));
      },
    }),
    byNode: t.drizzleConnection({
      type: UserNode,
      resolve: (query) => {
        expectTypeOf(query().orderBy).toEqualTypeOf<UserOrderBy>();

        return db.query.users.findMany(query());
      },
    }),
  }));
});

it('types drizzleField and drizzleFieldWithInput by a name, a list of one, or a ref', () => {
  builder.queryFields((t) => ({
    one: t.drizzleField({
      type: 'users',
      nullable: true,
      resolve: (query) => db.query.users.findFirst(query()),
    }),
    list: t.drizzleField({
      type: ['posts'],
      resolve: (query) => db.query.posts.findMany(query()),
    }),
    ref: t.drizzleField({
      type: UserIds,
      nullable: true,
      resolve: (query) => db.query.users.findFirst(query({ columns: { id: true } })),
    }),
    refList: t.drizzleField({
      type: [UserWithPosts],
      resolve: (query) =>
        db.query.users.findMany(
          query({ columns: { username: true }, with: { posts: { columns: { title: true } } } }),
        ),
    }),
    withInput: t.drizzleFieldWithInput({
      type: 'users',
      nullable: true,
      input: { id: t.input.int({ required: true }) },
      resolve: (query, _root, { input }) =>
        db.query.users.findFirst(query({ where: { id: input.id } })),
    }),
  }));
});

it('types connection helpers by the table a name or a ref gives', () => {
  const byName = drizzleConnectionHelpers(builder, 'users', {
    query: () => ({ orderBy: { username: 'asc' } }),
  });
  const byRef = drizzleConnectionHelpers(builder, UserIds, {});
  const bySelection = drizzleConnectionHelpers(builder, 'users', {
    select: () => ({ columns: { id: true } }),
    resolveNode: (user) => {
      expectTypeOf(user).toEqualTypeOf<UserIdsShape>();
      return user;
    },
  });

  expectTypeOf(byName.ref).toEqualTypeOf<DrizzleRef<Types, 'users', UserRow>>();
  expectTypeOf(byRef.ref).toEqualTypeOf<DrizzleRef<Types, 'users', UserIdsShape>>();
  expectTypeOf<Parameters<typeof byName.resolve>[0][number]>().toEqualTypeOf<UserRow>();
  expectTypeOf<Parameters<typeof byRef.resolve>[0][number]>().toEqualTypeOf<UserIdsShape>();
  expectTypeOf<Parameters<typeof bySelection.resolve>[0][number]>().toEqualTypeOf<UserIdsShape>();
});
