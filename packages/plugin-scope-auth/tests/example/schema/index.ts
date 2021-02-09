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

const ObjForAdminFn = builder.objectRef<{}>('ObjForAdminFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjForAdminFn');

    return {
      admin: true,
    };
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

const ObjForSyncPermFn = builder.objectRef<{ permission: string }>('ObjForSyncPermFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjForSyncPermFn');

    return {
      syncPermission: parent.permission,
    };
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

const ObjForAsyncPermFn = builder.objectRef<{ permission: string }>('ObjForAsyncPermFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjForAsyncPermFn');

    return {
      asyncPermission: parent.permission,
    };
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

const ObjForAllFn = builder.objectRef<{}>('ObjForAllFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjForAllFn');

    return {
      $all: {
        admin: true,
        syncPermission: 'a',
        asyncPermission: 'b',
      },
    };
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

const ObjForAnyFn = builder.objectRef<{}>('ObjForAnyFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjForAnyFn');

    return {
      $any: {
        admin: true,
        syncPermission: 'a',
        asyncPermission: 'b',
      },
    };
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

const ObjEmptyAllFn = builder.objectRef<{}>('ObjEmptyAllFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjEmptyAllFn');

    return {
      $all: {},
    };
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

const ObjEmptyAnyFn = builder.objectRef<{}>('ObjEmptyAnyFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjEmptyAnyFn');

    return {
      $any: {},
    };
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjBooleanFn = builder.objectRef<{ result: boolean }>('ObjBooleanFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjBooleanFn');

    return parent.result;
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const IfaceForAdmin = builder.interfaceRef('IfaceForAdmin').implement({
  authScopes: {
    admin: true,
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const IfaceBooleanFn = builder.interfaceRef<{ result: boolean }>('IfaceBooleanFn').implement({
  authScopes: (parent, context) => {
    context.count?.('ObjBooleanFn');

    return parent.result;
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjAdminIface = builder.objectRef('ObjAdminIface').implement({
  isTypeOf: () => true,
  interfaces: [IfaceForAdmin],
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjBooleanIface = builder.objectRef<{ result: boolean }>('ObjBooleanIface').implement({
  isTypeOf: () => true,
  interfaces: [IfaceBooleanFn],
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
    forAdminFn: t.string({
      authScopes: (parent, args, context) => {
        context.count?.('forAdminFn');

        return {
          admin: true,
        };
      },
      resolve: () => 'ok',
    }),
    forSyncPermissionFn: t.string({
      args: {
        permission: t.arg.string({}),
      },
      authScopes: (parent, args, context) => {
        context.count?.('forSyncPermissionFn');

        return {
          syncPermission: args.permission || 'a',
        };
      },
      resolve: () => 'ok',
    }),
    forAsyncPermissionFn: t.string({
      args: {
        permission: t.arg.string({}),
      },
      authScopes: (parent, args, context) => {
        context.count?.('forAsyncPermissionFn');

        return {
          asyncPermission: args.permission || 'b',
        };
      },
      resolve: () => 'ok',
    }),
    forAllFn: t.string({
      authScopes: (parent, args, context) => {
        context.count?.('forAllFn');

        return {
          // TODO should all prevent use of other permissions in same object?
          $all: {
            admin: true,
            syncPermission: 'a',
            asyncPermission: 'b',
          },
        };
      },
      resolve: () => 'ok',
    }),
    forAnyFn: t.string({
      authScopes: (parent, args, context) => {
        context.count?.('forAnyFn');

        return {
          $any: {
            admin: true,
            syncPermission: 'a',
            asyncPermission: 'b',
          },
        };
      },
      resolve: () => 'ok',
    }),
    emptyAnyFn: t.string({
      authScopes: (parent, args, context) => {
        context.count?.('emptyAnyFn');

        return {
          $any: {},
        };
      },
      resolve: () => 'ok',
    }),
    emptyAllFn: t.string({
      authScopes: (parent, args, context) => {
        context.count?.('emptyAllFn');

        return {
          $all: {},
        };
      },
      resolve: () => 'ok',
    }),
    forBooleanFn: t.string({
      args: {
        result: t.arg.boolean({ required: true }),
      },
      authScopes: (parent, args, context) => {
        context.count?.('forBooleanFn');

        return args.result;
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
    ObjForAdminFn: t.field({
      type: ObjForAdminFn,
      resolve: () => ({}),
    }),
    ObjForSyncPermFn: t.field({
      type: ObjForSyncPermFn,
      args: {
        permission: t.arg.string({}),
      },
      resolve: (parent, args) => ({ permission: args.permission || 'a' }),
    }),
    ObjForAsyncPermFn: t.field({
      type: ObjForAsyncPermFn,
      args: {
        permission: t.arg.string({}),
      },
      resolve: (parent, args) => ({ permission: args.permission || 'b' }),
    }),
    ObjForAllFn: t.field({
      type: ObjForAllFn,
      resolve: () => ({}),
    }),
    ObjForAnyFn: t.field({
      type: ObjForAnyFn,
      resolve: () => ({}),
    }),
    ObjEmptyAllFn: t.field({
      type: ObjEmptyAllFn,
      resolve: () => ({}),
    }),
    ObjEmptyAnyFn: t.field({
      type: ObjEmptyAnyFn,
      resolve: () => ({}),
    }),
    ObjBooleanFn: t.field({
      type: ObjBooleanFn,
      args: {
        result: t.arg.boolean({
          required: true,
        }),
      },
      resolve: (parent, args) => ({ result: args.result }),
    }),
    ObjAdminIface: t.field({
      type: ObjAdminIface,
      resolve: () => ({}),
    }),
    ObjBooleanIface: t.field({
      type: ObjBooleanIface,
      args: {
        result: t.arg.boolean({
          required: true,
        }),
      },
      resolve: (parent, args) => ({ result: args.result }),
    }),
    IfaceForAdmin: t.field({
      type: IfaceForAdmin,
      resolve: () => ({}),
    }),
    IfaceBooleanFn: t.field({
      type: IfaceBooleanFn,
      args: {
        result: t.arg.boolean({
          required: true,
        }),
      },
      resolve: (parent, args) => ({ result: args.result }),
    }),
  }),
});

export default builder.toSchema({});
