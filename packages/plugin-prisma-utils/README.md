# Prisma Utils Plugin for Pothos

> **Note:**
  This package is highly experimental and not recommended for production use


The plugin adds new helpers for creating prisma compatible input types. Use it alongside the Prisma plugin when you want these input helpers.

## Setup

To use this plugin, you will need to enable prismaUtils option in the generator in your
schema.prisma:

```prisma

generator client {
  provider      = "prisma-client"
  output        = "../lib/prisma"
}
generator pothos {
  provider = "prisma-pothos-types"
  clientOutput = "./prisma" // relative path from pothos output to prisma client
  output = "../lib/pothos-prisma-types.ts"
  // Enable prismaUtils feature
  prismaUtils  = true
}
```

Once this is enabled, add the plugin alongside the Prisma plugin. This example also uses
`graphql-scalars` to register the `DateTime` scalar used by the input helpers:

```package-install
npm install @pothos/plugin-prisma-utils graphql-scalars @prisma/adapter-better-sqlite3
```

```ts
import SchemaBuilder from '@pothos/core';
import { DateTimeResolver } from 'graphql-scalars';
import { PrismaClient } from '../lib/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import type PrismaTypes from '../lib/pothos-prisma-types';
import { getDatamodel } from '../lib/pothos-prisma-types';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '@pothos/plugin-prisma-utils';

export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

const builder = new SchemaBuilder<{
  Scalars: {
    DateTime: {
      Input: Date;
      Output: Date;
    };
  };
  PrismaTypes: PrismaTypes;
}>({
  plugins: [PrismaPlugin, PrismaUtils],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
});

builder.addScalarType('DateTime', DateTimeResolver, {});
```

## What can you do with this plugin

The helpers build filters, ordering, create inputs, and update inputs using the generated Prisma
types. You choose which fields and operations your API exposes.

## What is supported so far

### Creating filter types for scalars and enums

```typescript
const StringFilter = builder.prismaFilter('String', {
  ops: ['contains', 'equals', 'startsWith', 'not'],
});

export const IDFilter = builder.prismaFilter('Int', {
  ops: ['equals', 'not'],
});

builder.enumType(MyEnum, { name: 'MyEnum' });
const MyEnumFilter = builder.prismaFilter(MyEnum, {
  ops: ['not', 'equals'],
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
    author: UserWhere,
    // use t.field to provide other field options
    authorId: t.field({ type: IDFilter, description: 'filter by author id' }),
  }),
});
```

### Creating list filters for scalars

```typescript
export const StringListFilter = builder.prismaScalarListFilter('String', {
  name: 'StringListFilter',
  ops: ['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'],
});
```

### Creating list filters for Prisma objects

```typescript
const UserListFilter = builder.prismaListFilter(UserWhere, {
  ops: ['every', 'some', 'none'],
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

### Inputs for create mutations

You can use `builder.prismaCreate` to create input types for create mutations.

To get these types to work correctly for circular references, it is recommended to add explicit type
annotations, but for simple types that do not have circular references the explicit types can be
omitted.

```ts
import { InputObjectRef } from '@pothos/core';
import type { Prisma } from '../lib/prisma/client';

export const UserCreate: InputObjectRef<Prisma.UserCreateInput> = builder.prismaCreate('User', {
  name: 'UserCreate',
  fields: () => ({
    // scalars
    id: 'Int',
    email: 'String',
    name: 'String',
    // inputs for relations need to be defined separately as shown below
    profile: UserCreateProfile,
    // create fields for list relations are defined just like normal relations.
    // Pothos will automatically handle making the inputs lists
    posts: UserCreatePosts,
  }),
});

export const UserCreateProfile = builder.prismaCreateRelation('User', 'profile', {
  fields: () => ({
    // created with builder.prismaCreate as shown above for User
    create: ProfileCreateWithoutUser,
    // created with builder.prismaWhere
    connect: ProfileUniqueFilter,
  }),
});

export const UserCreatePosts = builder.prismaCreateRelation('User', 'posts', {
  fields: () => ({
    // created with builder.prismaCreate as shown above for User
    create: PostCreateWithoutAuthor,
    // created with builder.prismaWhere
    connect: PostUniqueFilter,
  }),
});
```

### Inputs for update mutations

You can use `builder.prismaUpdate` to create input types for update mutations.

To get these types to work correctly for circular references, it is recommended to add explicit type
annotations, but for simple types that do not have circular references the explicit types can be
omitted.

```ts
export const UserUpdate: InputObjectRef<Prisma.UserUpdateInput> = builder.prismaUpdate(
  'User',
  {
    name: 'UserUpdate',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      // inputs for relations need to be defined separately as shown below
      profile: UserUpdateProfile,
      posts: UserUpdatePosts,
    }),
  },
);

export const UserUpdateProfile = builder.prismaUpdateRelation('User', 'profile', {
  fields: () => ({
    // created with builder.prismaCreate
    create: ProfileCreateWithoutUser,
    // created with builder.prismaUpdate
    update: ProfileUpdateWithoutUser,
    // created with builder.prismaWhereUnique
    connect: ProfileUniqueFilter,
  }),
});

export const UserUpdatePosts = builder.prismaUpdateRelation('User', 'posts', {
  fields: () => ({
    // Not all update methods need to be defined
    // created with builder.prismaCreate
    create: PostCreateWithoutAuthor,
    // created with builder.prismaCreateMany
    createMany: {
      skipDuplicates: 'Boolean',
      data: PostCreateManyWithoutAuthor,
    },
    // created with builder.prismaWhereUnique
    set: PostUniqueFilter,
    // created with builder.prismaWhereUnique
    disconnect: PostUniqueFilter,
    delete: PostUniqueFilter,
    connect: PostUniqueFilter,

    update: {
      // created with builder.prismaWhereUnique
      where: PostUniqueFilter,
      // created with builder.prismaUpdate
      data: PostUpdateWithoutAuthor,
    },
    updateMany: {
      // created with builder.prismaWhere
      where: PostWithoutAuthorFilter,
      // created with builder.prismaUpdate
      data: PostUpdateWithoutAuthor,
    },
    // created with builder.prismaWhere
    deleteMany: PostWithoutAuthorFilter,
  }),
});
```

#### Atomic Int Update operations

```ts
const IntUpdate = builder.prismaIntAtomicUpdate();
// or with options
const IntUpdate = builder.prismaIntAtomicUpdate({
  name: 'IntUpdate',
  ops: ['increment', 'decrement'],
});

export const PostUpdate = builder.prismaUpdate('Post', {
  name: 'PostUpdate',
  fields: () => ({
    title: 'String',
    views: IntUpdate,
  }),
});
```

## Generators

Manually defining all the different input types shown above for a large number of tables can become
very repetitive. These utilities are designed to be building blocks for generators or utility
functions, so that you don't need to hand write these types yourself.

Pothos does not currently ship an official generator for prisma types, but there are a couple of
example generators that can be copied and modified to suit your needs. These are intentionally
somewhat limited in functionality and not written to be easily exported because they will be updated
with breaking changes as these utilities are developed further. They are only intended as building
blocks for you to build your own generators.

There are 2 main approaches:

1. Static Generation: Types are generated and written as a typescript file which can be imported
   from as part of your schema
2. Dynamic Generation: Types are generated dynamically at runtime through helpers imported from your
   App

### Static generator

You can find an
[example static generator here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/codegen/generator.ts)

This generator will generate a file with input types for every table in your schema as shown
[here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/codegen/schema/prisma-inputs.ts)

These generated types can be used in your schema as shown
[here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/codegen/schema/index.ts)

### Dynamic generator

You can find an example
[dynamic generator here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/crud/generator.ts)

This generator exports a class that can be used to dynamically create input types for your builder
as shown
[here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/crud/schema/index.ts#L9-L20)
