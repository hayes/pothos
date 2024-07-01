import './global-types';
import { GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  brandWithType,
  completeValue,
  FieldRef,
  InterfaceRef,
  OutputType,
  PothosError,
  SchemaTypes,
} from '@pothos/core';
import { PrismaInterfaceRef } from './interface-ref';
import { ModelLoader } from './model-loader';
import { PrismaNodeRef } from './node-ref';
import { PrismaObjectRef } from './object-ref';
import { PrismaObjectFieldBuilder } from './prisma-field-builder';
import { PrismaModelTypes, PrismaNodeOptions } from './types';
import { getDefaultIDParser, getDefaultIDSerializer } from './util/cursors';
import { getDelegateFromModel, getRefFromModel } from './util/datamodel';
import { getModelDescription } from './util/description';
import { getClient, getDMMF } from './util/get-client';
import { queryFromInfo } from './util/map-query';
import { getRelationMap } from './util/relation-map';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.prismaObject = function prismaObject(
  type,
  { fields, findUnique, select, include, description, ...options },
) {
  const ref = options.variant
    ? new PrismaObjectRef(options.variant, type)
    : (getRefFromModel(type, this) as PrismaObjectRef<SchemaTypes, PrismaModelTypes>);
  const name = options.variant ?? options.name ?? type;
  const fieldMap = getRelationMap(getDMMF(this)).get(type)!;
  const idSelection = ModelLoader.getDefaultIDSelection(ref, type, this);

  ref.name = name;

  this.objectType(ref, {
    ...(options as {}),
    description: getModelDescription(type, this, description),
    extensions: {
      ...options.extensions,
      pothosPrismaInclude: include,
      pothosPrismaModel: type,
      pothosPrismaFieldMap: fieldMap,
      pothosPrismaSelect: select && { ...idSelection, ...(select as {}) },
      pothosPrismaLoader: ModelLoader.forRef(ref, type, findUnique as never, this),
    },
    name,
    fields: fields
      ? () =>
          fields(
            new PrismaObjectFieldBuilder(
              ref.name,
              this,
              type,
              getRelationMap(getDMMF(this)).get(type)!,
            ),
          )
      : undefined,
  });

  return ref as never;
};

schemaBuilderProto.prismaInterface = function prismaInterface(
  type,
  { fields, findUnique, select, include, description, ...options },
) {
  const ref = options.variant
    ? new PrismaInterfaceRef(options.variant, type)
    : (getRefFromModel(type, this, 'interface') as PrismaInterfaceRef<
        SchemaTypes,
        PrismaModelTypes
      >);
  const name = options.variant ?? options.name ?? type;
  const fieldMap = getRelationMap(getDMMF(this)).get(type)!;
  const idSelection = ModelLoader.getDefaultIDSelection(ref, type, this);

  ref.name = name;

  this.interfaceType(ref, {
    ...(options as {}),
    description: getModelDescription(type, this, description),
    extensions: {
      ...options.extensions,
      pothosPrismaInclude: include,
      pothosPrismaModel: type,
      pothosPrismaFieldMap: fieldMap,
      pothosPrismaSelect: select && { ...idSelection, ...(select as {}) },
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
              'Interface',
            ),
          )
      : undefined,
  });

  return ref as never;
};

schemaBuilderProto.prismaNode = function prismaNode(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes> & {
    nodeInterfaceRef?: () => InterfaceRef<SchemaTypes, unknown>;
  },
  type: keyof SchemaTypes['PrismaTypes'],
  {
    id: { field, resolve: rawResolve, ...idOptions },
    findUnique: rawFindUnique,
    name,
    variant,
    nullable,
    ...options
  }: PrismaNodeOptions<SchemaTypes, PrismaModelTypes, [], never, {}, {}, undefined>,
) {
  const fieldName = field as unknown as string;
  const interfaceRef = this.nodeInterfaceRef?.();
  const resolve = rawResolve ?? getDefaultIDSerializer(type, fieldName, this);
  const idParser = fieldName ? getDefaultIDParser(type, fieldName, this) : undefined;
  const typeName = variant ?? name ?? type;
  const nodeRef = new PrismaNodeRef(typeName, type);
  const findUnique = rawFindUnique
    ? (parent: unknown, context: {}) =>
        rawFindUnique(resolve(parent as never, context) as string, context)
    : ModelLoader.getFindUniqueForField(nodeRef, type, fieldName, this);

  if (!interfaceRef) {
    throw new PothosError('builder.prismaNode requires @pothos/plugin-relay to be installed');
  }

  const extendedOptions = {
    ...options,
    name,
    variant,
    interfaces: [interfaceRef],
    findUnique,
    loadWithoutCache: async (
      id: string,
      context: SchemaTypes['Context'],
      info: GraphQLResolveInfo,
    ) => {
      const query = queryFromInfo({ context, info, typeName });
      const delegate = getDelegateFromModel(getClient(this, context), type);

      const record = await (delegate.findUniqueOrThrow && !nullable
        ? delegate.findUniqueOrThrow({
            ...query,
            where: rawFindUnique ? rawFindUnique(id, context) : { [fieldName]: idParser!(id) },
          } as never)
        : delegate.findUnique({
            ...query,
            ...(nullable ? {} : { rejectOnNotFound: true }),
            where: rawFindUnique ? rawFindUnique(id, context) : { [fieldName]: idParser!(id) },
          } as never));

      brandWithType(record, typeName as OutputType<SchemaTypes>);

      return record;
    },
  };

  const ref = this.prismaObject(type, extendedOptions as never);

  if (options.interfaces) {
    ref.addInterfaces(options.interfaces);
  }

  this.configStore.onTypeConfig(ref, (nodeConfig) => {
    this.objectField(
      ref,
      (this.options as { relayOptions?: { idFieldName?: string } }).relayOptions?.idFieldName ??
        'id',
      (t) =>
        (
          t as unknown as {
            globalID: (options: Record<string, unknown>) => FieldRef<SchemaTypes, unknown>;
          }
        ).globalID({
          ...(this.options as { relayOptions?: { idFieldOptions?: {} } }).relayOptions
            ?.idFieldOptions,
          ...idOptions,
          nullable: false,
          args: {},
          resolve: (parent: never, args: object, context: object, info: GraphQLResolveInfo) =>
            completeValue(resolve(parent, context), (id) => ({
              type: nodeConfig.name,
              id,
            })),
        }),
    );
  });

  this.configStore.associateParamWithRef(nodeRef, ref);

  return nodeRef;
} as never;

schemaBuilderProto.prismaObjectField = function prismaObjectField(type, fieldName, field) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : type;
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(
        new PrismaObjectFieldBuilder(
          name,
          this,
          ref.modelName,
          getRelationMap(getDMMF(this)).get(ref.modelName)!,
        ),
      ),
    }));
  });
};

schemaBuilderProto.prismaInterfaceField = function prismaInterfaceField(type, fieldName, field) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : type;
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(
        new PrismaObjectFieldBuilder(
          name,
          this,
          ref.modelName,
          getRelationMap(getDMMF(this)).get(ref.modelName)!,
          'Interface',
        ),
      ),
    }));
  });
};

schemaBuilderProto.prismaObjectFields = function prismaObjectFields(type, fields) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : type;
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () =>
      fields(
        new PrismaObjectFieldBuilder(
          name,
          this,
          ref.modelName,
          getRelationMap(getDMMF(this)).get(ref.modelName)!,
        ),
      ),
    );
  });
};

schemaBuilderProto.prismaInterfaceFields = function prismaInterfaceFields(type, fields) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : type;
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () =>
      fields(
        new PrismaObjectFieldBuilder(
          name,
          this,
          ref.modelName,
          getRelationMap(getDMMF(this)).get(ref.modelName)!,
          'Interface',
        ),
      ),
    );
  });
};
