import builder from '../builder';
import { db } from '../db';

const WithAuthInterface = builder.interfaceRef('WithAuthInterface').implement({
  fields: (t) => ({
    withAuthFromInterface: t.withAuth({ loggedIn: true }).boolean({
      nullable: true,
      resolve: (_, _args, ctx) => !!ctx.user.id,
    }),
  }),
});

const WithAuthObject = builder.objectRef('WithAuthObject').implement({
  interfaces: [WithAuthInterface],
  fields: (t) => ({
    withAuth: t.withAuth({ loggedIn: true }).boolean({
      nullable: true,
      resolve: (_, _args, ctx) => !!ctx.user.id,
    }),
  }),
});

builder.queryField('withAuth', (t) =>
  t.withAuth({ loggedIn: true }).boolean({
    nullable: true,
    resolve: (_, _args, ctx) => !!ctx.user.id,
  }),
);

builder.queryField('withAuthObject', (t) =>
  t.field({
    type: WithAuthObject,
    nullable: true,
    resolve: () => ({}),
  }),
);

builder.mutationField('withAuth', (t) =>
  t.withAuth({ loggedIn: true }).boolean({
    nullable: true,
    resolve: (_, _args, ctx) => !!ctx.user.id,
  }),
);

builder.subscriptionField('withAuth', (t) =>
  t.withAuth({ loggedIn: true }).boolean({
    nullable: true,

    // biome-ignore lint/suspicious/useAwait: <explanation>
    // biome-ignore lint/correctness/useYield: <explanation>
    subscribe: async function* subscribe() {
      return {};
    },
    resolve: (_, _args, ctx) => !!ctx.user.id,
  }),
);

builder.prismaObject('User', {
  authScopes: (user) => !!user.id,
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    withAUthOnPrismaObject: t.withAuth({ loggedIn: true }).boolean({
      nullable: true,
      resolve: () => true,
    }),
  }),
});

builder.queryField('post', (t) =>
  t.prismaField({
    type: 'Post',
    resolve: () => db.post.findFirstOrThrow({}),
  }),
);

builder.queryField('withAuthPrismaUser', (t) =>
  t.withAuth({ loggedIn: true }).prismaField({
    type: 'User',
    nullable: true,
    resolve: (query, _root, _args, ctx) =>
      db.user.findUniqueOrThrow({
        ...query,
        where: { id: Number.parseInt(ctx.user.id, 10) },
      }),
  }),
);

builder.queryField('withAuthFunction', (t) =>
  t
    .withAuth(() => ({
      loggedIn: true,
    }))
    .prismaField({
      type: 'User',
      nullable: true,
      resolve: (query, _root, _args, ctx) =>
        db.user.findUniqueOrThrow({
          ...query,
          where: { id: Number.parseInt(ctx.user.id, 10) },
        }),
    }),
);

builder.queryField('withAuthBoolean', (t) =>
  t
    .withAuth(() => Math.random() > 0.5 && { loggedIn: true })
    .prismaField({
      type: 'User',
      nullable: true,
      resolve: (query, _root, _args, ctx) =>
        'isLoggedIn' in ctx
          ? db.user.findUniqueOrThrow({
              ...query,
              where: { id: Number.parseInt(ctx.user.id, 10) },
            })
          : null,
    }),
);

builder.queryField('withAll', (t) =>
  t.withAuth({ $all: { loggedIn: true, admin: true } }).boolean({
    nullable: true,
    resolve: (_root, _args, ctx) => ctx.isAdmin && ctx.isLoggedIn,
  }),
);

builder.queryField('withAny', (t) =>
  t.withAuth({ $any: { loggedIn: true, admin: true } }).boolean({
    resolve: (_root, _args, ctx) =>
      ('isAdmin' in ctx && ctx.isAdmin) || ('isLoggedIn' in ctx && ctx.isLoggedIn),
  }),
);
