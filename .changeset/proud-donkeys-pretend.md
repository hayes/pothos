---
'@giraphql/plugin-prisma': minor
---

Re-designed how types are propagated in the prisma plugin to improve performance. This requires a
few breaking changes to how this plugin is used.

This change was required because of performance issue in typescript which has been reported here:
https://github.com/microsoft/TypeScript/issues/45405

If this is fixed, the API may be changed back to the slightly nicer string/name based version.

You will need to remove PrismaClient from the builder types, so your builder setup now looks like:

```ts
import PrismaPlugin, { PrismaTypes } from '@giraphql/plugin-prisma';

export default new SchemaBuilder<{}>({
  prisma: {
    client: prisma,
  },
});
```

You will also need to replace model names with the prisma delegates from your prisma client like the
following:

```ts
builder.prismaObject(prisma.post, {
  findUnique: (post) => ({ id: post.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.prismaField({
      type: prisma.user,
      resolve: async (query, root, args, ctx, info) =>
        prisma.user.findUnique({
          ...query,
          rejectOnNotFound: true,
          where: { id: ctx.userId },
        }),
    }),
  }),
});
```

See updated docs for more detailed usage.
