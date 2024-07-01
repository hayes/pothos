import { defaultTypeResolver, GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  completeValue,
  createContextCache,
  FieldMap,
  FieldRef,
  getTypeBrand,
  InputObjectRef,
  InterfaceParam,
  InterfaceRef,
  MaybePromise,
  ObjectFieldsShape,
  ObjectParam,
  ObjectRef,
  OutputRef,
  PothosValidationError,
  SchemaTypes,
  verifyRef,
} from '@pothos/core';
import { NodeRef } from './node-ref';
import { ConnectionShape, GlobalIDShape, PageInfoShape } from './types';
import { capitalize, resolveNodes } from './utils';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

const pageInfoRefMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  ObjectRef<SchemaTypes, PageInfoShape>
>();

const nodeInterfaceRefMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  InterfaceRef<SchemaTypes, {}>
>();

export const connectionRefs = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  ObjectRef<SchemaTypes, ConnectionShape<SchemaTypes, unknown, boolean>>[]
>();

export const globalConnectionFieldsMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  ((ref: ObjectRef<SchemaTypes, ConnectionShape<SchemaTypes, unknown, boolean>>) => void)[]
>();

schemaBuilderProto.pageInfoRef = function pageInfoRef() {
  if (pageInfoRefMap.has(this)) {
    return pageInfoRefMap.get(this)!;
  }

  const ref = this.objectRef<PageInfoShape>('PageInfo');

  pageInfoRefMap.set(this, ref);

  const {
    pageInfoCursorType = this.options.relay?.cursorType ?? 'String',
    hasNextPageFieldOptions = {} as never,
    hasPreviousPageFieldOptions = {} as never,
    startCursorFieldOptions = {} as never,
    endCursorFieldOptions = {} as never,
  } = this.options.relay ?? {};

  ref.implement({
    ...this.options.relay?.pageInfoTypeOptions,
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
        ...(startCursorFieldOptions as {}),
        type: pageInfoCursorType,
      }) as never,
      endCursor: t.expose('endCursor', {
        nullable: true,
        ...(endCursorFieldOptions as {}),
        type: pageInfoCursorType,
      }) as never,
    }),
  });

  return ref;
};

schemaBuilderProto.nodeInterfaceRef = function nodeInterfaceRef() {
  if (nodeInterfaceRefMap.has(this)) {
    return nodeInterfaceRefMap.get(this)!;
  }

  const ref = this.interfaceRef<{}>('Node');

  nodeInterfaceRefMap.set(this, ref);

  ref.implement({
    resolveType: (value, context, info, graphQLType) => {
      if (!value) {
        return defaultTypeResolver(value, context, info, graphQLType);
      }

      const typeBrand = getTypeBrand(value);

      if (typeBrand) {
        const type = this.configStore.getTypeConfig(typeBrand as string);

        return type.name;
      }

      try {
        if (typeof value === 'object') {
          // eslint-disable-next-line no-underscore-dangle
          const typename = (value as { __typename: string }).__typename;

          if (typename) {
            return typename;
          }

          // eslint-disable-next-line no-underscore-dangle
          const nodeRef = (value as { __type: OutputRef }).__type;

          if (nodeRef) {
            const config = this.configStore.getTypeConfig(nodeRef);

            if (config) {
              return config.name;
            }
          }
        }
      } catch {
        // ignore
      }

      return defaultTypeResolver(value, context, info, graphQLType);
    },
    ...this.options.relay?.nodeTypeOptions,
    fields: (t) => ({
      [this.options.relay?.idFieldName ?? 'id']: t.globalID({
        ...this.options.relay?.idFieldOptions,
        nullable: false,
        resolve: (parent) => {
          throw new PothosValidationError('id field not implemented');
        },
      }),
    }),
  });

  const nodeQueryOptions = this.options.relay?.nodeQueryOptions;

  if (nodeQueryOptions !== false) {
    const resolveNodeFn = nodeQueryOptions?.resolve;

    this.queryField(
      'node',
      (t) =>
        t.field({
          nullable: true,
          ...this.options.relay?.nodeQueryOptions,
          type: ref as InterfaceRef<SchemaTypes, unknown>,
          args: {
            id: t.arg.globalID({
              ...nodeQueryOptions?.args?.id,
              required: true,
              extensions: {
                relayGlobalIDAlwaysParse: true,
                ...nodeQueryOptions?.args?.id?.extensions,
              },
            }),
          },
          resolve: resolveNodeFn
            ? (root, args, context, info) =>
                resolveNodeFn(root, args, context, info, (ids) =>
                  completeValue(resolveNodes(this, context, info, [args.id]), (nodes) => nodes[0]),
                ) as never
            : (root, args, context, info) =>
                completeValue(resolveNodes(this, context, info, [args.id]), (nodes) => nodes[0]),
        }) as FieldRef<SchemaTypes, unknown>,
    );
  }

  const nodesQueryOptions = this.options.relay?.nodesQueryOptions;

  if (nodesQueryOptions !== false) {
    const resolveNodesFn = nodesQueryOptions?.resolve;

    this.queryField('nodes', (t) =>
      t.field({
        nullable: {
          list: false,
          items: true,
        },
        ...this.options.relay?.nodesQueryOptions,
        type: [ref],
        args: {
          ids: t.arg.globalIDList({
            ...nodesQueryOptions?.args?.ids,
            required: true,
            extensions: {
              relayGlobalIDAlwaysParse: true,
              ...nodesQueryOptions?.args?.ids?.extensions,
            },
          }),
        },
        resolve: resolveNodesFn
          ? (root, args, context, info) =>
              resolveNodesFn(
                root,
                args as { ids: { id: string; typename: string }[] },
                context,
                info,
                (ids) =>
                  resolveNodes(this, context, info, args.ids as { id: string; typename: string }[]),
              ) as never
          : (root, args, context, info) =>
              resolveNodes(
                this,
                context,
                info,
                args.ids as { id: string; typename: string }[],
              ) as never,
      }),
    );
  }

  return ref;
};

schemaBuilderProto.node = function node(param, { interfaces, extensions, id, ...options }, fields) {
  verifyRef(param);
  const interfacesWithNode: () => InterfaceParam<SchemaTypes>[] = () => [
    this.nodeInterfaceRef(),
    ...(typeof interfaces === 'function' ? interfaces() : interfaces ?? []),
  ];

  let nodeName!: string;

  const ref = this.objectType<[], ObjectParam<SchemaTypes>>(
    param,
    {
      ...(options as {}),
      extensions: {
        ...extensions,
        pothosParseGlobalID: id.parse,
      },
      isTypeOf:
        options.isTypeOf ??
        (typeof param === 'function'
          ? (maybeNode: unknown, context: object, info: GraphQLResolveInfo) => {
              if (!maybeNode) {
                return false;
              }

              if (maybeNode instanceof (param as Function)) {
                return true;
              }

              const proto = Object.getPrototypeOf(maybeNode) as { constructor: unknown };

              try {
                if (proto?.constructor) {
                  const config = this.configStore.getTypeConfig(proto.constructor as OutputRef);

                  return config.name === nodeName;
                }
              } catch {
                // ignore
              }

              return false;
            }
          : undefined),
      interfaces: interfacesWithNode as () => [],
    },
    fields,
  );

  this.configStore.onTypeConfig(ref, (nodeConfig) => {
    nodeName = nodeConfig.name;

    this.objectField(ref, this.options.relay?.idFieldName ?? 'id', (t) =>
      t.globalID<{}, false, MaybePromise<GlobalIDShape<SchemaTypes>>>({
        nullable: false,
        ...this.options.relay?.idFieldOptions,
        ...id,
        args: {},
        resolve: (parent, args, context, info): MaybePromise<GlobalIDShape<SchemaTypes>> =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          completeValue(id.resolve(parent, args, context, info), (globalId) => ({
            type: nodeConfig.name,
            id: globalId,
          })),
      }),
    );
  });

  const nodeRef = new NodeRef(ref.name, {
    parseId: id.parse,
  });

  this.configStore.associateParamWithRef(nodeRef, ref);

  return nodeRef as never;
};

schemaBuilderProto.globalConnectionField = function globalConnectionField(name, field) {
  this.globalConnectionFields((t) => ({ [name]: field(t) }));
};

schemaBuilderProto.globalConnectionFields = function globalConnectionFields(fields) {
  const onRef = (ref: ObjectRef<SchemaTypes, ConnectionShape<SchemaTypes, unknown, boolean>>) => {
    this.configStore.onPrepare(() => {
      const config = this.configStore.getTypeConfig(ref);

      this.objectFields(ref, (t) => {
        const existingFields = this.configStore.getFields(config.name);
        const refs: FieldMap = {};

        for (const [name, field] of Object.entries(fields(t as never))) {
          if (!existingFields.has(name)) {
            refs[name] = field;
          }
        }

        return refs;
      });
    });
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
  inputOptionsOrRef,
  { resolve, args, ...fieldOptions },
  {
    name: payloadName = `${capitalize(fieldName)}Payload`,
    outputFields,
    interfaces,
    ...payloadOptions
  },
) {
  const {
    relay: {
      clientMutationIdInputOptions = {} as never,
      clientMutationIdFieldOptions = {} as never,
      mutationInputArgOptions = {} as never,
    } = {},
  } = this.options;

  const includeClientMutationId =
    this.options.relay?.clientMutationId && this.options.relay?.clientMutationId !== 'omit';

  let inputRef: InputObjectRef<SchemaTypes, unknown> | null;
  let argName = 'input';

  if (!inputOptionsOrRef || inputOptionsOrRef instanceof InputObjectRef) {
    inputRef = inputOptionsOrRef;
  } else {
    const {
      name: inputName = `${capitalize(fieldName)}Input`,
      argName: argNameFromOptions = 'input',
      inputFields,
      ...inputOptions
    } = inputOptionsOrRef;
    argName = argNameFromOptions;

    inputRef = this.inputType(inputName, {
      ...this.options.relay?.defaultMutationInputTypeOptions,
      ...inputOptions,
      fields: (t) => ({
        ...inputFields(t),
        ...(includeClientMutationId
          ? {
              clientMutationId: t.id({
                ...clientMutationIdInputOptions,
                required: this.options.relay?.clientMutationId !== 'optional',
              }),
            }
          : {}),
      }),
    });
  }

  const payloadRef = this.objectRef<unknown>(payloadName).implement({
    ...this.options.relay?.defaultPayloadTypeOptions,
    ...payloadOptions,
    interfaces: interfaces as never,
    fields: (t) => ({
      ...(outputFields as ObjectFieldsShape<SchemaTypes, unknown>)(t),
      ...(includeClientMutationId
        ? {
            clientMutationId: t.id({
              nullable: this.options.relay?.clientMutationId === 'optional',
              ...clientMutationIdFieldOptions,
              resolve: (parent, _args, context, info) =>
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
        ...args,
        ...(inputRef
          ? {
              [argName]: t.arg({
                ...(mutationInputArgOptions as {}),
                type: inputRef,
                required: true,
              }),
            }
          : {}),
      },
      resolve: (root, fieldArgs, context, info) => {
        if (inputRef) {
          mutationIdCache(context).set(
            String(info.path.key),
            (fieldArgs as unknown as Record<string, { clientMutationId: string }>)[argName]
              .clientMutationId,
          );
        }

        return resolve(root, fieldArgs as never, context, info);
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
    edgesField,
    ...connectionOptions
  },
  edgeOptionsOrRef,
) {
  verifyRef(type);

  const {
    edgesFieldOptions: {
      nullable: edgesNullable = { items: true, list: true },
      ...edgesFieldOptions
    } = {} as never,
    pageInfoFieldOptions = {} as never,
  } = this.options.relay ?? {};

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

  const { nodesOnConnection } = this.options.relay ?? {};
  const edgesNullableOption = edgesNullableField ?? edgesNullable;

  const edgeListNullable = !!(
    (typeof edgesNullableOption === 'object' ? edgesNullableOption.list : edgesNullableOption) ??
    true
  );
  const edgeItemsNullable =
    typeof edgesNullableOption === 'object' && 'items' in (edgesNullableOption as {})
      ? edgesNullableOption.items
      : this.options.relay?.nodeFieldOptions?.nullable ?? true;

  this.objectType(connectionRef, {
    ...(this.options.relay?.defaultConnectionTypeOptions as {}),
    ...(connectionOptions as {}),
    fields: (t) => ({
      pageInfo: t.field({
        nullable: false,
        ...pageInfoFieldOptions,
        type: this.pageInfoRef(),
        resolve: (parent) => parent.pageInfo,
      }),
      edges: t.field({
        nullable: (edgesNullableField ?? edgesNullable) as { list: true; items: true },
        ...edgesFieldOptions,
        ...edgesField,
        type: [edgeRef],
        resolve: (parent) => parent.edges as [],
      }),
      ...(nodesOnConnection
        ? {
            nodes: t.field({
              ...(typeof nodesOnConnection === 'object' ? nodesOnConnection : {}),
              type: [type],
              nullable: {
                list: edgeListNullable,
                items:
                  edgeItemsNullable ??
                  nodeNullable ??
                  this.options.relay?.nodeFieldOptions?.nullable ??
                  true,
              },
              resolve: (con) =>
                completeValue(
                  con.edges,
                  (edges) => edges?.map((e) => e?.node) ?? (edgeListNullable ? null : []),
                ) as never,
            }),
          }
        : {}),
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
  nodeField,
  ...edgeOptions
}) {
  verifyRef(type);

  const {
    edgeCursorType = this.options.relay?.cursorType ?? 'String',
    cursorFieldOptions = {} as never,
    nodeFieldOptions: { nullable: nodeNullable = false, ...nodeFieldOptions } = {} as never,
  } = this.options.relay ?? {};

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
    ...(this.options.relay?.defaultEdgeTypeOptions as {}),
    ...edgeOptions,
    fields: (t) => ({
      node: t.field({
        nullable: nodeFieldNullable ?? nodeNullable,
        ...nodeFieldOptions,
        ...nodeField,
        type,
        resolve: (parent) => parent.node as never,
      }),
      cursor: t.expose('cursor', {
        nullable: false,
        type: edgeCursorType,
        ...cursorFieldOptions,
      }) as never,
      ...edgeFields?.(t),
    }),
  });

  return edgeRef as never;
};
