import './global-types';
import { GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  brandWithType,
  FieldRef,
  InterfaceRef,
  OutputType,
  SchemaTypes,
} from '@pothos/core';
import { PrismaObjectFieldBuilder } from './field-builder';
import { ModelLoader } from './model-loader';
import PrismaNodeRef from './node-ref';
import { PrismaModelTypes, PrismaNodeOptions } from './types';
import { getDelegateFromModel, getRefFromModel } from './util/datamodel';
import { getClient, getDMMF } from './util/get-client';
import { queryFromInfo } from './util/map-query';
import { getRelationMap } from './util/relation-map';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.prismaObject = function prismaObject(type, { fields, findUnique, ...options }) {
  const ref = options.variant ? this.objectRef(options.variant) : getRefFromModel(type, this);
  const name = options.variant ?? options.name ?? type;
  const fieldMap = getRelationMap(getDMMF(this)).get(type)!;

  ref.name = name;

  this.objectType(ref, {
    ...(options as {}),
    extensions: {
      ...options.extensions,
      pothosPrismaInclude: options.include,
      pothosPrismaModel: type,
      pothosPrismaFieldMap: fieldMap,
      pothosPrismaSelect: options.select,
      pothosPrismaLoader: ModelLoader.forRef(
        type,
        (findUnique as never) ||
          (() => {
            throw new Error(`Missing findUnique for ${ref.name}`);
          }),
        this,
      ),
    },
    name,
    fields: fields
      ? () =>
          fields(
            new PrismaObjectFieldBuilder(
              name,
              this,
              type,
              getRelationMap(getDMMF(this)).get(type)!,
            ),
          )
      : undefined,
  });

  return ref as never;
};

schemaBuilderProto.prismaNode = function prismaNode(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes> & {
    nodeInterfaceRef?: () => InterfaceRef<unknown>;
  },
  type: keyof SchemaTypes['PrismaTypes'],
  {
    findUnique,
    name,
    variant,
    ...options
  }: PrismaNodeOptions<SchemaTypes, PrismaModelTypes, [], never, {}, {}>,
) {
  const interfaceRef = this.nodeInterfaceRef?.();

  if (!interfaceRef) {
    throw new TypeError('builder.prismaNode requires @pothos/plugin-relay to be installed');
  }

  const typeName = variant ?? name ?? type;
  const nodeRef = new PrismaNodeRef(typeName);
  const extendedOptions = {
    ...options,
    variant,
    interfaces: [interfaceRef, ...(options.interfaces ?? [])],
    findUnique: (parent: unknown, context: {}) =>
      findUnique(options.id.resolve(parent as never, context) as string, context),
    loadWithoutCache: async (
      id: string,
      context: SchemaTypes['Context'],
      info: GraphQLResolveInfo,
    ) => {
      const query = queryFromInfo(context, info, typeName);
      const delegate = getDelegateFromModel(getClient(this, context), type);
      const record = await delegate.findUnique({
        ...query,
        rejectOnNotFound: true,
        where: findUnique(id, context),
      } as never);

      brandWithType(record, typeName as OutputType<SchemaTypes>);

      return record;
    },
  };

  const ref = this.prismaObject(type, extendedOptions as never);

  this.configStore.onTypeConfig(ref, (nodeConfig) => {
    this.objectField(ref, 'id', (t) =>
      (
        t as unknown as {
          globalID: (options: Record<string, unknown>) => FieldRef<unknown>;
        }
      ).globalID({
        ...options.id,
        nullable: false,
        args: {},
        resolve: async (
          parent: never,
          args: object,
          context: object,
          info: GraphQLResolveInfo,
        ) => ({
          type: nodeConfig.name,
          id: await options.id.resolve(parent, context),
        }),
      }),
    );
  });

  this.configStore.associateRefWithName(nodeRef, typeName);

  return nodeRef;
} as never;
