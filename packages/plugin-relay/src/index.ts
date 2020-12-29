import SchemaBuilder, {
  SchemaTypes,
  BasePlugin,
  RootFieldBuilder,
  FieldKind,
  ObjectRef,
  InterfaceRef,
  InterfaceParam,
  InputFieldMap,
  FieldNullability,
  InputShapeFromFields,
  OutputType,
  assertArray,
  ObjectParam,
  MaybePromise,
  FieldRef,
  OutputRef,
} from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';
import './global-types';
import {
  ConnectionShape,
  PageInfoShape,
  GlobalIDFieldOptions,
  NodeObjectOptions,
  GlobalIDShape,
  GlobalIDListFieldOptions,
} from './types';

export * from './utils';

export default class RelayPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin('GiraphQLRelay', RelayPlugin);

function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}

export function encodeGlobalID(typename: string, id: string | number | bigint) {
  return Buffer.from(`${typename}:${id}`).toString('base64');
}

export function decodeGlobalID(globalID: string) {
  const [typename, id] = Buffer.from(globalID, 'base64').toString().split(':');

  if (!typename || !id) {
    throw new TypeError(`Invalid global ID: ${globalID}`);
  }

  return { typename, id };
}

const nodeCache = new WeakMap<object, Map<string, MaybePromise<unknown>>>();

function getRequestCache(context: object) {
  if (!nodeCache.has(context)) {
    nodeCache.set(context, new Map());
  }

  return nodeCache.get(context)!;
}

export async function resolveUncachedNodesForType<Types extends SchemaTypes>(
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  context: object,
  ids: string[],
  type: string | OutputType<Types>,
): Promise<unknown[]> {
  const requestCache = getRequestCache(context);
  const config = builder.configStore.getTypeConfig(type, 'Object');
  const options = config.giraphqlOptions as NodeObjectOptions<Types, ObjectParam<Types>, []>;

  if (options.loadMany) {
    const loadManyPromise = Promise.resolve(options.loadMany(ids, context));

    return Promise.all(
      ids.map((id, i) => {
        const globalID = encodeGlobalID(config.name, id);
        const entryPromise = loadManyPromise
          .then((results: unknown[]) => results[i])
          .then((result: unknown) => {
            requestCache.set(globalID, result);

            return result;
          });

        requestCache.set(globalID, entryPromise);

        return entryPromise;
      }),
    );
  }

  if (options.loadOne) {
    return Promise.all(
      ids.map((id, i) => {
        const globalID = encodeGlobalID(config.name, id);
        const entryPromise = Promise.resolve(options.loadOne!(id, context)).then(
          (result: unknown) => {
            requestCache.set(globalID, result);

            return result;
          },
        );

        requestCache.set(globalID, entryPromise);

        return entryPromise;
      }),
    );
  }

  throw new Error(`${config.name} does not support loading by id`);
}

export async function resolveNodes<Types extends SchemaTypes>(
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  context: object,
  globalIDs: (string | null | undefined)[],
): Promise<MaybePromise<unknown>[]> {
  const requestCache = getRequestCache(context);
  const idsByType: Record<string, Set<string>> = {};

  globalIDs.forEach((globalID) => {
    if (globalID == null || requestCache.has(globalID)) {
      return;
    }

    const { id, typename } = decodeGlobalID(globalID);

    idsByType[typename] = idsByType[typename] || new Set();
    idsByType[typename].add(id);
  });

  await Promise.all([
    Object.keys(idsByType).map((typename) =>
      resolveUncachedNodesForType(builder, context, [...idsByType[typename]], typename),
    ),
  ]);

  return globalIDs.map((globalID) =>
    globalID == null ? null : requestCache.get(globalID) ?? null,
  );
}

const schemaBuilderProto = SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<
  SchemaTypes
>;
const fieldBuilderProto = RootFieldBuilder.prototype as GiraphQLSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

const pageInfoRefMap = new WeakMap<
  GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  ObjectRef<PageInfoShape>
>();

const nodeInterfaceRefMap = new WeakMap<
  GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  InterfaceRef<ObjectParam<SchemaTypes>>
>();

schemaBuilderProto.pageInfoRef = function pageInfoRef() {
  if (pageInfoRefMap.has(this)) {
    return pageInfoRefMap.get(this)!;
  }

  const ref = this.objectRef<PageInfoShape>('PageInfo');

  pageInfoRefMap.set(this, ref);

  ref.implement({
    ...this.options.relayOptions.pageInfoTypeOptions,
    fields: (t) => ({
      hasNextPage: t.exposeBoolean('hasNextPage', {}),
      hasPreviousPage: t.exposeBoolean('hasPreviousPage', {}),
      startCursor: t.exposeString('startCursor', { nullable: true }),
      endCursor: t.exposeString('endCursor', { nullable: true }),
    }),
  });

  return ref;
};

schemaBuilderProto.nodeInterfaceRef = function nodeInterfaceRef() {
  if (nodeInterfaceRefMap.has(this)) {
    return nodeInterfaceRefMap.get(this)!;
  }

  const ref = this.interfaceRef<ObjectParam<SchemaTypes>>('Node');

  nodeInterfaceRefMap.set(this, ref);

  ref.implement({
    ...this.options.relayOptions.nodeTypeOptions,
    fields: (t) => ({
      id: t.globalID({
        resolve: (parent) => {
          throw new Error('id field not implemented');
        },
      }),
    }),
  });

  this.queryField(
    'node',
    (t) =>
      t.field({
        ...this.options.relayOptions.nodeQueryOptions,
        type: ref as InterfaceRef<unknown>,
        args: {
          id: t.arg.id({ required: true }),
        },
        nullable: true,
        resolve: async (root, args, context) => (await resolveNodes(this, context, [String(args.id)]))[0],
      }) as FieldRef<unknown>,
  );

  this.queryField('nodes', (t) =>
    t.field({
      ...this.options.relayOptions.nodesQueryOptions,
      type: [ref],
      args: {
        ids: t.arg.idList({ required: true }),
      },
      nullable: {
        list: false,
        items: true,
      },
      resolve: async (root, args, context) => (await resolveNodes(this, context, args.ids as string[])) as Promise<ObjectParam<
          SchemaTypes
        > | null>[],
    }),
  );

  return ref;
};

schemaBuilderProto.node = function node(param, { interfaces, ...options }, fields) {
  const interfacesWithNode: InterfaceParam<SchemaTypes>[] = [
    this.nodeInterfaceRef(),
    ...((interfaces || []) as InterfaceParam<SchemaTypes>[]),
  ];

  let nodeName!: string;

  const ref = this.objectType<[], ObjectParam<SchemaTypes>>(
    param as ObjectParam<SchemaTypes>,
    {
      ...options,
      isTypeOf: (maybeNode, context, info) => {
        if (options.isTypeOf) {
          return options.isTypeOf(maybeNode, context, info);
        }

        if (!maybeNode) {
          return false;
        }

        if (typeof param === 'function' && (maybeNode as unknown) instanceof (param as Function)) {
          return true;
        }

        const proto = Object.getPrototypeOf(maybeNode) as { constructor: unknown };

        try {
          if (proto?.constructor) {
            const config = this.configStore.getTypeConfig(proto.constructor as OutputRef);

            return config.name === nodeName;
          }

          if (typeof maybeNode === 'object') {
            // eslint-disable-next-line no-underscore-dangle
            const nodeRef = (maybeNode as { __type: OutputRef }).__type;

            if (!nodeRef) {
              return false;
            }

            const config = this.configStore.getTypeConfig(nodeRef);

            return config.name === nodeName;
          }
        } catch (error) {
          // ignore
        }

        return false;
      },
      interfaces: interfacesWithNode as [],
    },
    fields,
  );

  this.configStore.onTypeConfig(ref, (nodeConfig) => {
    nodeName = nodeConfig.name;

    this.objectField(ref, 'id', (t) =>
      t.globalID<{}, false, Promise<GlobalIDShape<SchemaTypes>>>({
        ...options.id,
        nullable: false,
        args: {},
        resolve: async (parent, args, context, info) => ({
            type: nodeConfig.name,
            id: await options.id.resolve(parent, args, context, info),
          }),
      }),
    );
  });

  return ref;
};

fieldBuilderProto.globalIDList = function globalIDList<
  Args extends InputFieldMap,
  Nullable extends FieldNullability<['ID']>,
  ResolveReturnShape
>({
  resolve,
  ...options
}: GlobalIDListFieldOptions<SchemaTypes, unknown, Args, Nullable, ResolveReturnShape, FieldKind>) {
  const wrappedResolve = async (
    parent: unknown,
    args: InputShapeFromFields<Args>,
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const result = await resolve(parent, args, context, info);

    if (!result) {
      return result;
    }

    assertArray(result);

    if (Array.isArray(result)) {
      return (
        await Promise.all(result)
      ).map((item: GlobalIDShape<SchemaTypes> | null | undefined) =>
        item == null || typeof item === 'string'
          ? item
          : encodeGlobalID(this.builder.configStore.getTypeConfig(item.type).name, String(item.id)),
      );
    }

    return null;
  };

  return this.field({
    ...options,
    type: ['ID'],
    resolve: wrappedResolve as never, // resolve is not expected because we don't know FieldKind
  });
};

fieldBuilderProto.globalID = function globalID<
  Args extends InputFieldMap,
  Nullable extends FieldNullability<'ID'>,
  ResolveReturnShape
>({
  resolve,
  ...options
}: GlobalIDFieldOptions<SchemaTypes, unknown, Args, Nullable, ResolveReturnShape, FieldKind>) {
  const wrappedResolve = async (
    parent: unknown,
    args: InputShapeFromFields<Args>,
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const result = await resolve(parent, args, context, info);

    if (!result || typeof result === 'string') {
      return result;
    }

    const item = (result as unknown) as GlobalIDShape<SchemaTypes>;

    return encodeGlobalID(this.builder.configStore.getTypeConfig(item.type).name, String(item.id));
  };

  return this.field({
    ...options,
    type: 'ID',
    resolve: wrappedResolve as never, // resolve is not expected because we don't know FieldKind
  });
};

fieldBuilderProto.node = function node({ id, ...options }) {
  return this.field<{}, InterfaceRef<unknown>, unknown, Promise<unknown>, true>({
    ...options,
    type: this.builder.nodeInterfaceRef(),
    nullable: true,
    resolve: async (parent: unknown, args: {}, context: object, info: GraphQLResolveInfo) => {
      const rawID = (await id(parent, args as any, context, info)) as
        | string
        | GlobalIDShape<SchemaTypes>
        | null
        | undefined;

      if (rawID == null) {
        return null;
      }

      const globalID =
        typeof rawID === 'string'
          ? rawID
          : encodeGlobalID(
              this.builder.configStore.getTypeConfig(rawID.type).name,
              String(rawID.id),
            );

      return (await resolveNodes(this.builder, context, [globalID]))[0];
    },
  });
};

fieldBuilderProto.nodeList = function nodeList({ ids, ...options }) {
  return this.field({
    ...options,
    nullable: {
      list: false,
      items: true,
    },
    type: [this.builder.nodeInterfaceRef()],
    resolve: async (parent: unknown, args: {}, context: object, info: GraphQLResolveInfo) => {
      const rawIDList = await ids(parent, args as any, context, info);

      assertArray(rawIDList);

      if (!Array.isArray(rawIDList)) {
        return [];
      }

      const rawIds = (await Promise.all(rawIDList)) as (
        | GlobalIDShape<SchemaTypes>
        | string
        | null
        | undefined
      )[];

      const globalIds = rawIds.map((id) =>
        !id || typeof id === 'string'
          ? id
          : encodeGlobalID(this.builder.configStore.getTypeConfig(id.type).name, String(id.id)),
      );

      return resolveNodes(this.builder, context, globalIds);
    },
  });
};

fieldBuilderProto.connection = function connection(
  { type, ...fieldOptions },
  connectionOptions,
  edgeOptions,
) {
  const placeholderRef = this.builder.objectRef<ConnectionShape<unknown, false>>(
    'Unnamed connection',
  );

  const fieldRef = this.field({
    ...fieldOptions,
    type: placeholderRef,
    args: {
      ...fieldOptions.args,
      before: this.arg.id({}),
      after: this.arg.id({}),
      first: this.arg.int({}),
      last: this.arg.int({}),
    },
    resolve: fieldOptions.resolve as never,
  });

  this.builder.configStore.onFieldUse(fieldRef, (fieldConfig) => {
    const connectionName =
      connectionOptions.name ||
      `${this.typename}${capitalize(fieldConfig.name)}${
        fieldConfig.name.toLowerCase().endsWith('connection') ? '' : 'Connection'
      }`;
    const connectionRef = this.builder.objectRef<ConnectionShape<unknown, false>>(connectionName);
    const edgeName = edgeOptions.name || `${connectionName}Edge`;
    const edgeRef = this.builder.objectRef<{
      cursor: string;
      node: unknown;
    }>(edgeName);

    this.builder.objectType(connectionRef, {
      fields: (t) => ({
        pageInfo: t.field({
          type: this.builder.pageInfoRef(),
          resolve: (parent) => parent.pageInfo,
        }),
        edges: t.field({
          type: [edgeRef],
          nullable: {
            list: false,
            items: true,
          },
          resolve: (parent) => parent.edges,
        }),
      }),
    });

    this.builder.configStore.associateRefWithName(placeholderRef, connectionName);

    this.builder.objectType(edgeRef, {
      fields: (t) => ({
        node: t.field({
          type,
          resolve: (parent) => parent.node as never,
        }),
        cursor: t.exposeString('cursor', {}),
      }),
    });
  });

  return fieldRef as ReturnType<typeof fieldBuilderProto.connection>;
};
