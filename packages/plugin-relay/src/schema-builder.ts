/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  createContextCache,
  FieldRef,
  getTypeBrand,
  InterfaceParam,
  InterfaceRef,
  ObjectFieldsShape,
  ObjectFieldThunk,
  ObjectParam,
  ObjectRef,
  OutputRef,
  SchemaTypes,
  verifyRef,
} from '@pothos/core';
import { ConnectionShape, GlobalIDShape, PageInfoShape } from './types';
import { capitalize, resolveNodes } from './utils';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

const pageInfoRefMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  ObjectRef<PageInfoShape>
>();

const nodeInterfaceRefMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  InterfaceRef<ObjectParam<SchemaTypes>>
>();

export const connectionRefs = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  ObjectRef<ConnectionShape<SchemaTypes, unknown, boolean>>[]
>();

export const globalConnectionFieldsMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  ((ref: ObjectRef<ConnectionShape<SchemaTypes, unknown, boolean>>) => void)[]
>();

schemaBuilderProto.pageInfoRef = function pageInfoRef() {
  if (pageInfoRefMap.has(this)) {
    return pageInfoRefMap.get(this)!;
  }

  const ref = this.objectRef<PageInfoShape>('PageInfo');

  pageInfoRefMap.set(this, ref);

  const {
    cursorType = 'String',
    hasNextPageFieldOptions = {} as never,
    hasPreviousPageFieldOptions = {} as never,
    startCursorFieldOptions = {} as never,
    endCursorFieldOptions = {} as never,
  } = this.options.relayOptions;

  ref.implement({
    ...this.options.relayOptions.pageInfoTypeOptions,
    fields: (t) => ({
      hasNextPage: t.exposeBoolean('hasNextPage', {
        nullable: false,
        ...hasNextPageFieldOptions,
      }),
      hasPreviousPage: t.exposeBoolean('hasPreviousPage', {
        nullable: false,
        ...hasPreviousPageFieldOptions,
      }),
      startCursor: t.expose('startCursor', {
        nullable: true,
        ...startCursorFieldOptions,
        type: cursorType,
      }) as never,
      endCursor: t.expose('endCursor', {
        nullable: true,
        ...endCursorFieldOptions,
        type: cursorType,
      }) as never,
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
        nullable: false,
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
        nullable: true,
        ...this.options.relayOptions.nodeQueryOptions,
        type: ref as InterfaceRef<unknown>,
        args: {
          id: t.arg.id({ required: true }),
        },
        resolve: async (root, args, context, info) =>
          (await resolveNodes(this, context, info, [String(args.id)]))[0],
      }) as FieldRef<unknown>,
  );

  this.queryField('nodes', (t) =>
    t.field({
      nullable: {
        list: false,
        items: true,
      },
      ...this.options.relayOptions.nodesQueryOptions,
      type: [ref],
      args: {
        ids: t.arg.idList({ required: true }),
      },
      resolve: async (root, args, context, info) =>
        (await resolveNodes(this, context, info, args.ids as string[])) as Promise<
          ObjectParam<SchemaTypes>
        >[],
    }),
  );

  return ref;
};

schemaBuilderProto.node = function node(param, { interfaces, ...options }, fields) {
  verifyRef(param);
  const interfacesWithNode: InterfaceParam<SchemaTypes>[] = [
    this.nodeInterfaceRef(),
    ...((interfaces ?? []) as InterfaceParam<SchemaTypes>[]),
  ];

  let nodeName!: string;

  const ref = this.objectType<[], ObjectParam<SchemaTypes>>(
    param,
    {
      ...(options as {}),
      isTypeOf: (maybeNode: unknown, context: object, info: GraphQLResolveInfo) => {
        if (options.isTypeOf) {
          return options.isTypeOf(maybeNode, context, info);
        }

        if (!maybeNode) {
          return false;
        }

        const typeBrand = getTypeBrand(maybeNode);

        if (typeBrand && this.configStore.getTypeConfig(typeBrand as string).name === nodeName) {
          return true;
        }

        if (typeof param === 'function' && maybeNode instanceof (param as Function)) {
          return true;
        }

        const proto = Object.getPrototypeOf(maybeNode) as { constructor: unknown };

        try {
          if (typeof maybeNode === 'object') {
            // eslint-disable-next-line no-underscore-dangle
            const typename = (maybeNode as { __typename: string }).__typename;

            if (typename === nodeName) {
              return true;
            }

            // eslint-disable-next-line no-underscore-dangle
            const nodeRef = (maybeNode as { __type: OutputRef }).__type;

            if (!nodeRef) {
              return false;
            }

            const config = this.configStore.getTypeConfig(nodeRef);

            return config.name === nodeName;
          }

          if (proto?.constructor) {
            const config = this.configStore.getTypeConfig(proto.constructor as OutputRef);

            return config.name === nodeName;
          }
        } catch {
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
        nullable: false,
        ...options.id,
        args: {},
        resolve: async (parent, args, context, info) => ({
          type: nodeConfig.name,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          id: await options.id.resolve(parent, args, context, info),
        }),
      }),
    );
  });

  return ref;
};

schemaBuilderProto.globalConnectionField = function globalConnectionField(name, field) {
  const onRef = (ref: ObjectRef<ConnectionShape<SchemaTypes, unknown, boolean>>) => {
    this.objectField(
      ref,
      name,
      field as ObjectFieldThunk<SchemaTypes, ConnectionShape<SchemaTypes, unknown, boolean>>,
    );
  };

  connectionRefs.get(this)?.forEach((ref) => void onRef(ref));

  if (!globalConnectionFieldsMap.has(this)) {
    globalConnectionFieldsMap.set(this, []);
  }

  globalConnectionFieldsMap.get(this)!.push(onRef);
};

schemaBuilderProto.globalConnectionFields = function globalConnectionFields(fields) {
  const onRef = (ref: ObjectRef<ConnectionShape<SchemaTypes, unknown, boolean>>) => {
    this.objectFields(
      ref,
      fields as ObjectFieldsShape<SchemaTypes, ConnectionShape<SchemaTypes, unknown, boolean>>,
    );
  };

  connectionRefs.get(this)?.forEach((ref) => void onRef(ref));

  if (!globalConnectionFieldsMap.has(this)) {
    globalConnectionFieldsMap.set(this, []);
  }

  globalConnectionFieldsMap.get(this)!.push(onRef);
};

const mutationIdCache = createContextCache(() => new Map<string, string>());

schemaBuilderProto.relayMutationField = function relayMutationField(
  fieldName,
  {
    name: inputName = `${capitalize(fieldName)}Input`,
    argName = 'input',
    inputFields,
    ...inputOptions
  },
  { resolve, ...fieldOptions },
  {
    name: payloadName = `${capitalize(fieldName)}Payload`,
    outputFields,
    interfaces,
    ...paylaodOptions
  },
) {
  const {
    relayOptions: {
      clientMutationIdInputOptions = {} as never,
      clientMutationIdFieldOptions = {} as never,
      mutationInputArgOptions = {} as never,
    },
  } = this.options;

  const includeClientMutationId = this.options.relayOptions.clientMutationId !== 'omit';

  const inputRef = this.inputType(inputName, {
    ...inputOptions,
    fields: (t) => ({
      ...inputFields(t),
      ...(includeClientMutationId
        ? {
            clientMutationId: t.id({
              ...clientMutationIdInputOptions,
              required: this.options.relayOptions.clientMutationId !== 'optional',
            }),
          }
        : {}),
    }),
  });

  const payloadRef = this.objectRef<unknown>(payloadName).implement({
    ...paylaodOptions,
    interfaces: interfaces as never,
    fields: (t) => ({
      ...(outputFields as ObjectFieldsShape<SchemaTypes, unknown>)(t),
      ...(includeClientMutationId
        ? {
            clientMutationId: t.id({
              nullable: this.options.relayOptions.clientMutationId === 'optional',
              ...clientMutationIdFieldOptions,
              resolve: (parent, args, context, info) =>
                mutationIdCache(context).get(String(info.path.prev!.key))!,
            }),
          }
        : {}),
    }),
  });

  this.mutationField(fieldName, (t) =>
    t.field({
      ...(fieldOptions as {}),
      type: payloadRef,
      args: {
        [argName]: t.arg({ ...(mutationInputArgOptions as {}), type: inputRef, required: true }),
      },
      resolve: (root, args, context, info) => {
        mutationIdCache(context).set(
          String(info.path.key),
          (args as unknown as Record<string, { clientMutationId: string }>)[argName]
            .clientMutationId,
        );

        return resolve(root, args as never, context, info);
      },
    }),
  );

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    inputType: inputRef,
    payloadType: payloadRef,
  } as never;
};

schemaBuilderProto.connectionObject = function connectionObject(
  {
    type,
    name: connectionName,
    edgesNullable: edgesNullableField,
    nodeNullable,
    ...connectionOptions
  },
  edgeOptionsOrRef,
) {
  verifyRef(type);

  const {
    edgesFieldOptions: {
      nullable: edgesNullable = { items: true, list: false },
      ...edgesFieldOptions
    } = {} as never,
    pageInfoFieldOptions = {} as never,
  } = this.options.relayOptions;

  const connectionRef =
    this.objectRef<ConnectionShape<SchemaTypes, unknown, false>>(connectionName);

  const edgeRef =
    edgeOptionsOrRef instanceof ObjectRef
      ? edgeOptionsOrRef
      : this.edgeObject({
          name: `${connectionName.replace(/Connection$/, '')}Edge`,
          ...edgeOptionsOrRef,
          nodeNullable,
          type,
        });

  const connectionFields = connectionOptions.fields as unknown as
    | ObjectFieldsShape<SchemaTypes, ConnectionShape<SchemaTypes, unknown, false>>
    | undefined;

  this.objectType(connectionRef, {
    ...connectionOptions,
    fields: (t) => ({
      pageInfo: t.field({
        nullable: false,
        ...pageInfoFieldOptions,
        type: this.pageInfoRef(),
        resolve: (parent) => parent.pageInfo,
      }),
      edges: t.field({
        nullable: (edgesNullableField ?? edgesNullable) as { list: false; items: true },
        ...edgesFieldOptions,
        type: [edgeRef],
        resolve: (parent) => parent.edges as [],
      }),
      ...connectionFields?.(t as never),
    }),
  });

  if (!connectionRefs.has(this)) {
    connectionRefs.set(this, []);
  }

  connectionRefs.get(this)!.push(connectionRef);

  globalConnectionFieldsMap.get(this)?.forEach((fieldFn) => void fieldFn(connectionRef));

  return connectionRef as never;
};

schemaBuilderProto.edgeObject = function edgeObject({
  type,
  name: edgeName,
  nodeNullable: nodeFieldNullable,
  ...edgeOptions
}) {
  verifyRef(type);

  const {
    cursorType = 'String',
    cursorFieldOptions = {} as never,
    nodeFieldOptions: { nullable: nodeNullable = false, ...nodeFieldOptions } = {} as never,
  } = this.options.relayOptions;

  const edgeRef = this.objectRef<{
    cursor: string;
    node: unknown;
  }>(edgeName);

  const edgeFields = edgeOptions.fields as
    | ObjectFieldsShape<
        SchemaTypes,
        {
          cursor: string;
          node: unknown;
        }
      >
    | undefined;

  this.objectType(edgeRef, {
    ...edgeOptions,
    fields: (t) => ({
      node: t.field({
        nullable: nodeFieldNullable ?? nodeNullable,
        ...nodeFieldOptions,
        type,
        resolve: (parent) => parent.node as never,
      }),
      cursor: t.expose('cursor', {
        nullable: false,
        type: cursorType,
        ...cursorFieldOptions,
      }) as never,
      ...edgeFields?.(t),
    }),
  });

  return edgeRef as never;
};
