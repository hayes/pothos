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
import { getDefaultIDParser, getDefaultIDSerializer } from './util/cursors';
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
      pothosPrismaLoader: ModelLoader.forRef(ref, type, findUnique as never, this),
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
    id: { field, resolve: rawResolve, ...idOptions },
    findUnique: rawFindUnique,
    name,
    variant,
    ...options
  }: PrismaNodeOptions<SchemaTypes, PrismaModelTypes, [], never, {}, {}, undefined>,
) {
  const fieldName = field as unknown as string;
  const interfaceRef = this.nodeInterfaceRef?.();
  const resolve = rawResolve ?? getDefaultIDSerializer(type, fieldName, this);
  const idParser = fieldName ? getDefaultIDParser(type, fieldName, this) : undefined;
  const typeName = variant ?? name ?? type;
  const nodeRef = new PrismaNodeRef(typeName);
  const findUnique = rawFindUnique
    ? (parent: unknown, context: {}) =>
        rawFindUnique(resolve(parent as never, context) as string, context)
    : ModelLoader.getFindUniqueForField(nodeRef, type, fieldName, this);

  if (!interfaceRef) {
    throw new TypeError('builder.prismaNode requires @pothos/plugin-relay to be installed');
  }

  const extendedOptions = {
    ...options,
    variant,
    interfaces: [interfaceRef],
    findUnique,
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
        where: rawFindUnique ? rawFindUnique(id, context) : { [fieldName]: idParser!(id) },
      } as never);

      brandWithType(record, typeName as OutputType<SchemaTypes>);

      return record;
    },
  };

  const ref = this.prismaObject(type, extendedOptions as never);

  if (options.interfaces) {
    this.configStore.addInterfaces(typeName, options.interfaces);
  }

  this.configStore.onTypeConfig(ref, (nodeConfig) => {
    this.objectField(ref, 'id', (t) =>
      (
        t as unknown as {
          globalID: (options: Record<string, unknown>) => FieldRef<unknown>;
        }
      ).globalID({
        ...idOptions,
        nullable: false,
        args: {},
        resolve: async (
          parent: never,
          args: object,
          context: object,
          info: GraphQLResolveInfo,
        ) => ({
          type: nodeConfig.name,
          id: await resolve(parent, context),
        }),
      }),
    );
  });

  this.configStore.associateRefWithName(nodeRef, typeName);

  return nodeRef;
} as never;
