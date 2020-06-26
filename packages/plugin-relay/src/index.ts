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
} from '@giraphql/core';
import './global-types';
import {
  ConnectionShape,
  PageInfoShape,
  GlobalIDFieldOptions,
  NodeObjectOptions,
  NodeReturnShape,
} from './types';
import { GraphQLResolveInfo } from 'graphql';

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

const nodeCache = new WeakMap<object, Map<string, unknown>>();

function getRequestCache<Types extends SchemaTypes>(
  context: object,
): Map<string, MaybePromise<NodeReturnShape<Types> | null>> {
  if (!nodeCache.has(context)) {
    nodeCache.set(context, new Map());
  }

  return nodeCache.get(context)! as Map<string, MaybePromise<NodeReturnShape<Types> | null>>;
}

export async function resolveUncachedNodesForType<Types extends SchemaTypes>(
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  context: object,
  ids: string[],
  type: string | OutputType<Types>,
): Promise<(NodeReturnShape<Types> | null)[]> {
  const requestCache = getRequestCache<Types>(context);
  const config = builder.configStore.getTypeConfig(type, 'Object');
  const options = config.giraphqlOptions as NodeObjectOptions<Types, ObjectParam<Types>, []>;

  if (options.loadMany) {
    const loadManyPromise = Promise.resolve(options.loadMany(ids, context));

    return Promise.all(
      ids.map((id, i) => {
        const globalID = encodeGlobalID(config.name, id);
        const entryPromise = loadManyPromise
          .then((results: (NodeReturnShape<Types> | null)[]) => results[i])
          .then((result: NodeReturnShape<Types> | null) => {
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
          (result: NodeReturnShape<Types> | null) => {
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
  globalIds: string[],
): Promise<MaybePromise<NodeReturnShape<Types> | null>[]> {
  const requestCache = getRequestCache<Types>(context);
  const idsByType: Record<string, Set<string>> = {};

  globalIds.forEach((globalID) => {
    if (requestCache.has(globalID)) {
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

  return globalIds.map((globalId) => requestCache.get(globalId) ?? null);
}

const schemaBuilderProto: GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes> = SchemaBuilder.prototype;
const fieldBuilderProto: GiraphQLSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind> =
  RootFieldBuilder.prototype;

const pageInfoRefMap = new WeakMap<
  GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  ObjectRef<PageInfoShape>
>();

const nodeInterfaceRefMap = new WeakMap<
  GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  InterfaceRef<NodeReturnShape<SchemaTypes>>
>();

schemaBuilderProto.pageInfoRef = function pageInfoRef() {
  if (pageInfoRefMap.has(this)) {
    return pageInfoRefMap.get(this)!;
  }

  const ref = this.objectRef<PageInfoShape>('PageInfo');

  pageInfoRefMap.set(this, ref);

  ref.implement({
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

  const ref = this.interfaceRef<NodeReturnShape<SchemaTypes>>('Node');

  nodeInterfaceRefMap.set(this, ref);

  ref.implement({
    fields: (t) => ({
      id: t.globalID({
        resolve: (parent) => ({ id: parent.id, type: parent.__type }),
      }),
    }),
  });

  this.queryField('node', (t) =>
    t.field({
      type: ref,
      args: {
        id: t.arg.id({ required: true }),
      },
      nullable: true,
      resolve: async (root, args, context) => {
        return (await resolveNodes(this, context, [String(args.id)]))[0];
      },
    }),
  );

  this.queryField('nodes', (t) =>
    t.field({
      type: [ref],
      args: {
        ids: t.arg.idList({ required: true }),
      },
      nullable: {
        list: false,
        items: true,
      },
      resolve: async (root, args, context) => {
        return (await resolveNodes(this, context, args.ids as string[])) as Promise<NodeReturnShape<
          SchemaTypes
        > | null>[];
      },
    }),
  );

  return ref;
};

schemaBuilderProto.node = function node(param, { interfaces, isTypeOf, ...options }, fields) {
  const interfacesWithNode: InterfaceParam<SchemaTypes>[] = [
    this.nodeInterfaceRef(),
    ...(interfaces || []),
  ];

  let nodeName!: string;

  const ref = this.objectType<[], ObjectParam<SchemaTypes>>(
    param as ObjectParam<SchemaTypes>,
    {
      ...options,
      isTypeOf: (node) => {
        const ref = (node as NodeReturnShape<SchemaTypes>).__type;

        if (!ref) {
          return false;
        }

        const config = this.configStore.getTypeConfig(ref);

        return config.name === nodeName;
      },
      interfaces: interfacesWithNode as [],
    },
    fields,
  );

  this.configStore.onTypeConfig(ref, (nodeConfig) => {
    nodeName = nodeConfig.name;
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
}: GlobalIDFieldOptions<
  SchemaTypes,
  unknown,
  ['ID'],
  Args,
  Nullable,
  ResolveReturnShape,
  FieldKind
>) {
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
      ).map((item: { id: string; type: OutputType<SchemaTypes> } | null | undefined) =>
        item == null
          ? item
          : encodeGlobalID(this.builder.configStore.getTypeConfig(item.type).name, item.id),
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
}: GlobalIDFieldOptions<
  SchemaTypes,
  unknown,
  'ID',
  Args,
  Nullable,
  ResolveReturnShape,
  FieldKind
>) {
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

    const item = (result as unknown) as { id: string; type: OutputType<SchemaTypes> };

    return encodeGlobalID(this.builder.configStore.getTypeConfig(item.type).name, item.id);
  };

  return this.field({
    ...options,
    type: 'ID',
    resolve: wrappedResolve as never, // resolve is not expected because we don't know FieldKind
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
