/* eslint-disable @typescript-eslint/require-await */
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

const ObjForAdminAsyncFn = builder.objectRef<{}>('ObjForAdminAsyncFn').implement({
  authScopes: async (parent, context) => {
    context.count?.('ObjForAdminAsyncFn');

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

const ObjExpectsGrants = builder.objectRef<{}>('ObjExpectsGrants').implement({
  authScopes: {
    $granted: 'grantedFromParent',
  },
  fields: (t) => ({
    field: t.string({
      resolve: () => 'ok',
    }),
  }),
});

const ObjFieldExpectsGrants = builder.objectRef<{}>('ObjFieldExpectsGrants').implement({
  fields: (t) => ({
    field: t.string({
      authScopes: {
        $granted: 'grantedFromParent',
      },
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

const ObjWithSkipFields = builder.objectRef<{}>('ObjWithSkipFields').implement({
  authScopes: {
    syncPermission: 'a',
  },
  fields: (t) => ({
    skip: t.string({
      authScopes: {
        syncPermission: 'b',
      },
      nullable: true,
      skipTypeScopes: true,
      resolve: () => 'ok',
    }),
  }),
});

const ObjWithIfaceSkipFields = builder.objectRef<{}>('ObjWithIfaceSkipFields').implement({
  isTypeOf: () => true,
  interfaces: [IfaceForAdmin],
  authScopes: {
    syncPermission: 'a',
  },
  fields: (t) => ({
    skipType: t.string({
      authScopes: {
        syncPermission: 'b',
      },
      skipTypeScopes: true,
      nullable: true,
      resolve: () => 'ok',
    }),
    skipIface: t.string({
      authScopes: {
        syncPermission: 'b',
      },
      skipInterfaceScopes: true,
      nullable: true,
      resolve: () => 'ok',
    }),
    skipBoth: t.string({
      authScopes: {
        syncPermission: 'b',
      },
      skipTypeScopes: true,
      skipInterfaceScopes: true,
      nullable: true,
      resolve: () => 'ok',
    }),
  }),
});

builder.queryType({
  grantScopes: (root, context) => {
    context.count?.('Query.grantScopes');

    return ['grantedFromQuery'];
  },
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
    forAdminAsyncFn: t.string({
      authScopes: async (parent, args, context) => {
        context.count?.('forAdminAsyncFn');

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
    grantedFromRoot: t.string({
      authScopes: {
        $granted: 'grantedFromQuery',
      },
      resolve: () => 'ok',
    }),
    notGrantedFromRoot: t.string({
      authScopes: {
        $granted: 'notGrantedFromRoot',
      },
      resolve: () => 'ok',
    }),
    ObjForAdmin: t.field({
      type: ObjForAdmin,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjForSyncPerm: t.field({
      type: ObjForSyncPerm,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjForAsyncPerm: t.field({
      type: ObjForAsyncPerm,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjForAll: t.field({
      type: ObjForAll,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjForAny: t.field({
      type: ObjForAny,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjEmptyAll: t.field({
      type: ObjEmptyAll,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjEmptyAny: t.field({
      type: ObjEmptyAny,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjForAdminFn: t.field({
      type: ObjForAdminFn,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjForAdminAsyncFn: t.field({
      type: ObjForAdminAsyncFn,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjForSyncPermFn: t.field({
      type: ObjForSyncPermFn,
      nullable: true,
      args: {
        permission: t.arg.string({}),
      },
      resolve: (parent, args) => ({ permission: args.permission || 'a' }),
    }),
    ObjForAsyncPermFn: t.field({
      type: ObjForAsyncPermFn,
      nullable: true,
      args: {
        permission: t.arg.string({}),
      },
      resolve: (parent, args) => ({ permission: args.permission || 'b' }),
    }),
    ObjForAllFn: t.field({
      type: ObjForAllFn,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjForAnyFn: t.field({
      type: ObjForAnyFn,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjEmptyAllFn: t.field({
      type: ObjEmptyAllFn,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjEmptyAnyFn: t.field({
      type: ObjEmptyAnyFn,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjBooleanFn: t.field({
      type: ObjBooleanFn,
      nullable: true,
      args: {
        result: t.arg.boolean({
          required: true,
        }),
      },
      resolve: (parent, args) => ({ result: args.result }),
    }),
    ObjExpectsGrants: t.field({
      type: ObjExpectsGrants,
      nullable: true,
      grantScopes: ['grantedFromParent'],
      resolve: () => ({}),
    }),
    ObjExpectsGrantsMissing: t.field({
      type: ObjExpectsGrants,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjExpectsGrantsFn: t.field({
      type: ObjExpectsGrants,
      nullable: true,
      args: {
        result: t.arg.boolean({ required: true }),
      },
      grantScopes: (parent, args) => (args.result ? ['grantedFromParent'] : []),
      resolve: () => ({}),
    }),
    ObjExpectsGrantsAsyncFn: t.field({
      type: ObjExpectsGrants,
      nullable: true,
      args: {
        result: t.arg.boolean({ required: true }),
      },
      grantScopes: async (parent, args) => (args.result ? ['grantedFromParent'] : []),
      resolve: () => ({}),
    }),
    ObjFieldExpectsGrants: t.field({
      type: ObjFieldExpectsGrants,
      nullable: true,
      grantScopes: ['grantedFromParent'],
      resolve: () => ({}),
    }),
    ObjFieldExpectsGrantsMissing: t.field({
      type: ObjFieldExpectsGrants,
      nullable: true,
      grantScopes: ['wrong'],
      resolve: () => ({}),
    }),
    ObjFieldExpectsGrantsFn: t.field({
      type: ObjFieldExpectsGrants,
      nullable: true,
      args: {
        result: t.arg.boolean({ required: true }),
      },
      grantScopes: (parent, args) => (args.result ? ['grantedFromParent'] : []),
      resolve: () => ({}),
    }),
    ObjFieldExpectsGrantsAsyncFn: t.field({
      type: ObjFieldExpectsGrants,
      nullable: true,
      args: {
        result: t.arg.boolean({ required: true }),
      },
      grantScopes: async (parent, args) => (args.result ? ['grantedFromParent'] : []),
      resolve: () => ({}),
    }),
    ObjExpectsGrantsList: t.field({
      type: [ObjExpectsGrants],
      nullable: { list: true, items: true },
      grantScopes: ['grantedFromParent'],
      resolve: () => [{}, {}],
    }),
    ObjExpectsGrantsListMissing: t.field({
      type: [ObjExpectsGrants],
      nullable: { list: true, items: true },
      resolve: () => [{}, {}],
    }),
    ObjExpectsGrantsListFn: t.field({
      type: [ObjExpectsGrants],
      nullable: { list: true, items: true },
      args: {
        result: t.arg.boolean({ required: true }),
      },
      grantScopes: (parent, args) => (args.result ? ['grantedFromParent'] : []),
      resolve: () => [{}, {}],
    }),
    ObjExpectsGrantsListAsyncFn: t.field({
      type: [ObjExpectsGrants],
      nullable: { list: true, items: true },
      args: {
        result: t.arg.boolean({ required: true }),
      },
      grantScopes: async (parent, args) => (args.result ? ['grantedFromParent'] : []),
      resolve: () => [{}, {}],
    }),
    ObjFieldExpectsGrantsList: t.field({
      type: [ObjFieldExpectsGrants],
      nullable: { items: true, list: true },
      grantScopes: ['grantedFromParent'],
      resolve: () => [{}, {}],
    }),
    ObjFieldExpectsGrantsListMissing: t.field({
      type: [ObjFieldExpectsGrants],
      nullable: { items: true, list: true },
      resolve: () => [{}, {}],
    }),
    ObjFieldExpectsGrantsListFn: t.field({
      type: [ObjFieldExpectsGrants],
      nullable: { items: true, list: true },
      args: {
        result: t.arg.boolean({ required: true }),
      },
      grantScopes: (parent, args) => (args.result ? ['grantedFromParent'] : []),
      resolve: () => [{}, {}],
    }),
    ObjFieldExpectsGrantsListAsyncFn: t.field({
      type: [ObjFieldExpectsGrants],
      nullable: { items: true, list: true },
      args: {
        result: t.arg.boolean({ required: true }),
      },
      grantScopes: async (parent, args) => (args.result ? ['grantedFromParent'] : []),
      resolve: () => [{}, {}],
    }),
    ObjAdminIface: t.field({
      type: ObjAdminIface,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjBooleanIface: t.field({
      type: ObjBooleanIface,
      nullable: true,
      args: {
        result: t.arg.boolean({
          required: true,
        }),
      },
      resolve: (parent, args) => ({ result: args.result }),
    }),
    IfaceForAdmin: t.field({
      type: IfaceForAdmin,
      nullable: true,
      resolve: () => ({}),
    }),
    IfaceBooleanFn: t.field({
      type: IfaceBooleanFn,
      nullable: true,
      args: {
        result: t.arg.boolean({
          required: true,
        }),
      },
      resolve: (parent, args) => ({ result: args.result }),
    }),
    ObjWithSkipFields: t.field({
      type: ObjWithSkipFields,
      nullable: true,
      resolve: () => ({}),
    }),
    ObjWithIfaceSkipFields: t.field({
      type: ObjWithIfaceSkipFields,
      nullable: true,

      resolve: () => ({}),
    }),
  }),
});

export default builder.toSchema({});
