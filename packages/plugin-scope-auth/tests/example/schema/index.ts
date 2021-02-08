import builder from '../builder';

const ObjForAdmin = builder.objectRef<{}>('ObjForAdmin').implement({
  authScopes: {
    admin: true,
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjForSyncPerm = builder.objectRef<{}>('ObjForSyncPerm').implement({
  authScopes: {
    syncPermission: 'a',
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjForAsyncPerm = builder.objectRef<{}>('ObjForAsyncPerm').implement({
  authScopes: {
    asyncPermission: 'b',
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjForAll = builder.objectRef<{}>('ObjForAll').implement({
  authScopes: {
    $all: {
      admin: true,
      syncPermission: 'a',
      asyncPermission: 'b',
    },
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjForAny = builder.objectRef<{}>('ObjForAny').implement({
  authScopes: {
    $any: {
      admin: true,
      syncPermission: 'a',
      asyncPermission: 'b',
    },
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjEmptyAll = builder.objectRef<{}>('ObjEmptyAll').implement({
  authScopes: {
    $all: {},
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjEmptyAny = builder.objectRef<{}>('ObjEmptyAny').implement({
  authScopes: {
    $any: {},
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    forAdmin: t.string({
      authScopes: {
        admin: true,
      },
      resolve: () => 'ok',
    }),
    forSyncPermission: t.string({
      authScopes: {
        syncPermission: 'a',
      },
      resolve: () => 'ok',
    }),
    forAsyncPermission: t.string({
      authScopes: {
        asyncPermission: 'b',
      },
      resolve: () => 'ok',
    }),
    forAll: t.string({
      authScopes: {
        // TODO should all prevent use of other permissions in same object?
        $all: {
          admin: true,
          syncPermission: 'a',
          asyncPermission: 'b',
        },
      },
      resolve: () => 'ok',
    }),
    forAny: t.string({
      authScopes: {
        $any: {
          admin: true,
          syncPermission: 'a',
          asyncPermission: 'b',
        },
      },
      resolve: () => 'ok',
    }),
    emptyAny: t.string({
      authScopes: {
        $any: {},
      },
      resolve: () => 'ok',
    }),
    emptyAll: t.string({
      authScopes: {
        $all: {},
      },
      resolve: () => 'ok',
    }),
    ObjForAdmin: t.field({
      type: ObjForAdmin,
      resolve: () => ({}),
    }),
    ObjForSyncPerm: t.field({
      type: ObjForSyncPerm,
      resolve: () => ({}),
    }),
    ObjForAsyncPerm: t.field({
      type: ObjForAsyncPerm,
      resolve: () => ({}),
    }),
    ObjForAll: t.field({
      type: ObjForAll,
      resolve: () => ({}),
    }),
    ObjForAny: t.field({
      type: ObjForAny,
      resolve: () => ({}),
    }),
    ObjEmptyAll: t.field({
      type: ObjEmptyAll,
      resolve: () => ({}),
    }),
    ObjEmptyAny: t.field({
      type: ObjEmptyAny,
      resolve: () => ({}),
    }),
  }),
});

export default builder.toSchema({});
