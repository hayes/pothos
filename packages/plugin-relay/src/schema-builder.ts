import SchemaBuilder, {
  FieldRef,
  InterfaceParam,
  InterfaceRef,
  ObjectParam,
  ObjectRef,
  OutputRef,
  SchemaTypes,
} from '@giraphql/core';
import { GlobalIDShape, PageInfoShape } from './types';
import { resolveNodes } from './utils';

const schemaBuilderProto = SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

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
        resolve: async (root, args, context) =>
          (await resolveNodes(this, context, [String(args.id)]))[0],
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
      resolve: async (root, args, context) =>
        (await resolveNodes(
          this,
          context,
          args.ids as string[],
        )) as Promise<ObjectParam<SchemaTypes> | null>[],
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
