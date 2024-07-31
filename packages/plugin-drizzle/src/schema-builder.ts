import SchemaBuilder, {
  brandWithType,
  completeValue,
  InterfaceRef,
  ObjectRef,
  OutputType,
  PothosError,
  SchemaTypes,
  FieldRef,
  InputObjectRef,
} from '@pothos/core';
import { DrizzleObjectFieldBuilder } from './drizzle-field-builder';
import { getRefFromModel } from './utils/refs';
import { DrizzleObjectRef } from './object-ref';
import { DrizzleGraphQLInputExtensions, DrizzleNodeOptions } from './types';
import { getColumnParser, getColumnSerializer } from './utils/cursors';
import { DrizzleNodeRef } from './node-ref';
import { GraphQLInputObjectType, GraphQLResolveInfo } from 'graphql';
import { ModelLoader } from './model-loader';
import { DrizzleInterfaceRef } from './interface-ref';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.drizzleObject = function drizzleObject(table, { select, fields, ...options }) {
  const name = options.variant ?? options.name ?? table;

  const ref = options.variant
    ? new DrizzleObjectRef(options.variant, name)
    : (getRefFromModel(table, this, 'object') as ObjectRef<SchemaTypes, unknown>);

  ref.name = name ?? table;

  this.objectType(ref, {
    ...(options as {}),
    extensions: {
      ...options.extensions,
      pothosDrizzleModel: table,
      pothosDrizzleTable: this.options.drizzle.client._.schema?.[table],
      pothosDrizzleSelect: select ?? {},
      pothosDrizzleLoader: ModelLoader.forModel(table, this),
    },
    name,
    fields: fields ? () => fields(new DrizzleObjectFieldBuilder(ref.name, this, table)) : undefined,
  });

  return ref as never;
};

schemaBuilderProto.drizzleInterface = function drizzleInterface(
  table,
  { select, fields, ...options },
) {
  const name = options.name ?? table;

  const ref = options.variant
    ? new DrizzleInterfaceRef(options.variant, name)
    : (getRefFromModel(table, this, 'interface') as InterfaceRef<SchemaTypes, unknown>);

  ref.name = name ?? table;

  this.interfaceType(ref, {
    ...(options as {}),
    extensions: {
      ...options.extensions,
      pothosDrizzleModel: table,
      pothosDrizzleTable: this.options.drizzle.client._.schema?.[table],
      pothosDrizzleSelect: select ?? {},
      pothosDrizzleLoader: ModelLoader.forModel(table, this),
    },
    name,
    fields: fields
      ? () => fields(new DrizzleObjectFieldBuilder(ref.name, this, table, 'Interface'))
      : undefined,
  });

  return ref as never;
};

schemaBuilderProto.drizzleNode = function drizzleNode(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes> & {
    nodeInterfaceRef?: () => InterfaceRef<SchemaTypes, unknown>;
  },
  table: keyof SchemaTypes['DrizzleRelationSchema'],
  {
    id: { column, ...idOptions },
    name,
    variant,
    ...options
  }: DrizzleNodeOptions<SchemaTypes, keyof SchemaTypes['DrizzleRelationSchema'], {}, {}, []>,
) {
  const tableConfig = this.options.drizzle.client._.schema![table];
  const idColumn = typeof column === 'function' ? column(tableConfig.columns) : column;
  const idColumns = Array.isArray(idColumn) ? idColumn : [idColumn];
  const interfaceRef = this.nodeInterfaceRef?.();
  const resolve = getColumnSerializer(idColumns);
  const idParser = getColumnParser(idColumns);
  const typeName = variant ?? name ?? table;
  const nodeRef = new DrizzleNodeRef(typeName, table);
  const modelLoader = ModelLoader.forModel(table, this, idColumns);

  if (!interfaceRef) {
    throw new PothosError('builder.drizzleNode requires @pothos/plugin-relay to be installed');
  }

  const extendedOptions = {
    ...options,
    name,
    variant,
    interfaces: [interfaceRef],
    loadWithoutCache: async (
      id: string,
      context: SchemaTypes['Context'],
      info: GraphQLResolveInfo,
    ) => {
      const record = await modelLoader(context).loadSelectionForField(info, idParser(id), typeName);

      if (record) {
        brandWithType(record, typeName as OutputType<SchemaTypes>);
      }

      return record;
    },
  };

  const ref = this.drizzleObject(table, extendedOptions as never);

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
            completeValue(resolve(parent), (id) => ({
              type: nodeConfig.name,
              id,
            })),
        }),
    );
  });

  this.configStore.associateParamWithRef(nodeRef, ref);

  return nodeRef;
} as never;

schemaBuilderProto.drizzleObjectField = function drizzleObjectField(type, fieldName, field) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : (type as never);
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new DrizzleObjectFieldBuilder(name, this, ref.tableName)),
    }));
  });
};

schemaBuilderProto.drizzleInterfaceField = function drizzleInterfaceField(type, fieldName, field) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : (type as never);
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new DrizzleObjectFieldBuilder(name, this, ref.tableName, 'Interface')),
    }));
  });
};

schemaBuilderProto.drizzleObjectFields = function drizzleObjectFields(type, fields) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : (type as never);
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () =>
      fields(new DrizzleObjectFieldBuilder(name, this, ref.tableName)),
    );
  });
};

schemaBuilderProto.drizzleInterfaceFields = function drizzleInterfaceFields(type, fields) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : (type as never);
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () =>
      fields(new DrizzleObjectFieldBuilder(name, this, ref.tableName, 'Interface')),
    );
  });
};

schemaBuilderProto.drizzleGraphQLOrderBy = function drizzleGraphQLOrderBy(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  table: string,
  type: GraphQLInputObjectType,
  options?: { extensions?: {} },
) {
  return (
    this as typeof this & {
      addGraphQLInput: (
        type: GraphQLInputObjectType,
        options: Record<string, unknown>,
      ) => InputObjectRef<SchemaTypes, {}>;
    }
  ).addGraphQLInput(type, {
    ...options,
    extensions: {
      ...options?.extensions,
      drizzleGraphQL: {
        inputType: 'orderBy',
        table,
        tableConfig: this.options.drizzle.client._.schema?.[table]!,
      } satisfies DrizzleGraphQLInputExtensions,
    },
  });
} as never;

schemaBuilderProto.drizzleGraphQLFilters = function drizzleGraphQLFilters(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  table: string,
  type: GraphQLInputObjectType,
  options?: { extensions?: {} },
) {
  return (
    this as typeof this & {
      addGraphQLInput: (
        type: GraphQLInputObjectType,
        options: Record<string, unknown>,
      ) => InputObjectRef<SchemaTypes, {}>;
    }
  ).addGraphQLInput(type, {
    ...options,
    extensions: {
      ...options?.extensions,
      drizzleGraphQL: {
        inputType: 'filters',
        table,
        tableConfig: this.options.drizzle.client._.schema?.[table]!,
      } satisfies DrizzleGraphQLInputExtensions,
    },
  });
} as never;

schemaBuilderProto.drizzleGraphQLInsert = function drizzleGraphQLInsert(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  table: string,
  type: GraphQLInputObjectType,
  options?: { extensions?: {} },
) {
  return (
    this as typeof this & {
      addGraphQLInput: (
        type: GraphQLInputObjectType,
        options: Record<string, unknown>,
      ) => InputObjectRef<SchemaTypes, {}>;
    }
  ).addGraphQLInput(type, {
    ...options,
    extensions: {
      ...options?.extensions,
      drizzleGraphQL: {
        inputType: 'insert',
        table,
        tableConfig: this.options.drizzle.client._.schema?.[table]!,
      } satisfies DrizzleGraphQLInputExtensions,
    },
  });
} as never;

schemaBuilderProto.drizzleGraphQLUpdate = function drizzleGraphQLUpdate(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  table: string,
  type: GraphQLInputObjectType,
  options?: { extensions?: {} },
) {
  return (
    this as typeof this & {
      addGraphQLInput: (
        type: GraphQLInputObjectType,
        options: Record<string, unknown>,
      ) => InputObjectRef<SchemaTypes, {}>;
    }
  ).addGraphQLInput(type, {
    ...options,
    extensions: {
      ...options?.extensions,
      drizzleGraphQL: {
        inputType: 'update',
        table,
        tableConfig: this.options.drizzle.client._.schema?.[table]!,
      } satisfies DrizzleGraphQLInputExtensions,
    },
  });
} as never;
