# Prisma utils for Pothos

This package is highly experimental and not ready for production use

## What can you do with this plugin

Currently this plugin is focused on making it easier to define prisma compatible input types that
take advantage of the types defined in your Prisma schema.

The goal is not to generate all input types automatically, but rather to provide building blocks so
that writing your own helpers or code-generators becomes a lot easier. There are far too many
tradeoffs and choices to be made when designing input types for queries that one solution won't work
for everyone.

This plugin will eventually provide more helpers and examples that should allow anyone to quickly
set something up to automatically creates all their input types (and eventually other crud
operations).

## What is supported so far

### Creating filter types for scalars and enums

```typescript
const StringFilter = builder.prismaFilter('String', {
  ops: ['contains', 'equals', 'startsWith', 'not', 'equals'],
});

export const IDFilter = builder.prismaFilter('Int', {
  ops: ['equals', 'not'],
});

builder.enumType(MyEnum, { name: 'MyEnum' });
const MyEnumFilter = builder.prismaFilter(MyEnum, {
  ops: ['not', 'equals'],
});
```

### Creating list filters

```typescript
const StringListFilter = builder.prismaListFilter(StringFilter, {
  ops: ['every', 'some', 'none'],
});
```

### Creating filters for Prisma objects (compatible with a "where" clause)

```typescript
const UserWhere = builder.prismaWhere('User', {
  fields: {
    id: IDFilter,
  },
});

const PostFilter = builder.prismaWhere('Post', {
  fields: (t) => ({
    // You can use either filters
    id: IDFilter,
    // or scalar types to only support equality
    title: 'String',
    createdAt: 'DateTime',
    // Relations are supported by referencing other scalars
    author: UserFilter,
    // use t.field to provide other field options
    authorId: t.field({ type: IDFilter, description: 'filter by author id' }),
  }),
});
```

### Creating OrderBy input types

```typescript
const UserOrderBy = builder.prismaOrderBy('User', {
  fields: {
    name: true,
  },
});

export const PostOrderBy = builder.prismaOrderBy('Post', {
  fields: () => ({
    id: true,
    title: true,
    createdAt: true,
    author: UserOrderBy,
  }),
});
```

## Using the building blocks above, you can create utils that create all your input types automatically

```typescript
const prismaArgs = argsForTypes(builder, ['Post', 'Comment', 'User']);

builder.queryType({
  fields: (t) => ({
    posts: t.prismaField({
      type: ['Post'],
      args: prismaArgs.Post,
      resolve: (query, _, args) =>
        prisma.post.findMany({
          ...query,
          where: args.filter ?? undefined,
          orderBy: args.orderBy ?? undefined,
          take: 3,
        }),
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
  }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: true }),
    posts: t.relation('posts', {
      args: prismaArgs.Post,
      query: (args) => ({
        where: args.filter ?? undefined,
        orderBy: args.orderBy ?? undefined,
        take: 2,
      }),
    }),
  }),
});

export default builder.toSchema();
```

To implement something like the above, you can look at the example provided
[here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/crud/schema/generator.ts)
