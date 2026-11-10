import SchemaBuilder, {
  brandWithType,
  completeValue,
  type FieldRef,
  type InterfaceRef,
  type ObjectRef,
  type OutputType,
  PothosError,
  PothosSchemaError,
  type SchemaTypes,
} from '@pothos/core';
import type { Column, TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import { DrizzleObjectFieldBuilder } from './drizzle-field-builder.js';
import { DrizzleInterfaceRef } from './interface-ref.js';
import { ModelLoader, typeParentLoader } from './model-loader.js';
import { DrizzleNodeRef } from './node-ref.js';
import { DrizzleObjectRef } from './object-ref.js';
import type { DrizzleNodeOptions } from './types.js';
import { type DrizzleAdapter, drizzleAdapter, UnknownRelationError } from './utils/adapter.js';
import { getSchemaConfig } from './utils/config.js';
import { getIDParser, getIDSerializer } from './utils/cursors.js';
import { getRefFromModel } from './utils/refs.js';
import type { SelectionMap } from './utils/selections.js';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

/**
 * The body of `drizzleObject` and `drizzleInterface`. The two build the same ref, extensions and
 * field builder; only the ref class and which of `objectType`/`interfaceType` registers it differ.
 */
function defineDrizzleType(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  table: string,
  {
    select,
    fields,
    ...options
  }: {
    select?: {} | boolean;
    fields?: (t: DrizzleObjectFieldBuilder<SchemaTypes, TableRelationalConfig, {}>) => {};
    variant?: string;
    name?: string;
    extensions?: {};
  },
  kind: 'Interface' | 'Object',
  method = `drizzle${kind}`,
) {
  const isInterface = kind === 'Interface';
  const name = options.variant ?? options.name ?? table;
  const ref = options.variant
    ? isInterface
      ? new DrizzleInterfaceRef(options.variant, table)
      : new DrizzleObjectRef(options.variant, table)
    : (getRefFromModel(table, builder, isInterface ? 'interface' : 'object') as ObjectRef<
        SchemaTypes,
        unknown
      >);

  ref.name = name;

  const schemaConfig = getSchemaConfig(builder);
  const typeSelect = typeof select === 'object' ? { columns: {}, ...select } : undefined;
  const loader = ModelLoader.forModel(table, builder);
  // Planned once here, so a mistake in the type's `select` fails the build.
  const typeNode = planTypeSelect(
    drizzleAdapter(schemaConfig),
    schemaConfig.relations[table],
    typeSelect ?? {},
    `${method} ${name}`,
  );

  const config = {
    ...options,
    extensions: {
      ...options.extensions,
      pothosDrizzleModel: table,
      pothosDrizzleTable: schemaConfig.relations[table],
      pothosDrizzleSelect: typeSelect ?? select ?? true,
      pothosDrizzleLoader: loader,
      // Read by scope-auth for the row its checks see. Without a `select`, that is every column.
      ...(isInterface
        ? {}
        : {
            pothosScopeAuthParent: typeParentLoader(loader, typeNode),
          }),
    },
    name,
    fields: fields
      ? () => fields(new DrizzleObjectFieldBuilder(name, builder, table, kind) as never)
      : undefined,
  };

  if (isInterface) {
    builder.interfaceType(ref as never, config as never);
  } else {
    builder.objectType(ref as never, config as never);
  }

  return ref;
}

/** The node of a type-level `select`, with a relation the table lacks as a schema error. */
function planTypeSelect(
  adapter: DrizzleAdapter,
  table: TableRelationalConfig,
  selection: SelectionMap,
  definedBy: string,
) {
  const root = adapter.createNode(table);

  try {
    adapter.mergeQuery(root, selection);
  } catch (error) {
    if (error instanceof UnknownRelationError) {
      throw new PothosSchemaError(
        `The select of ${definedBy} includes relation "${error.relation}", which table ${error.table} does not have`,
      );
    }

    throw error;
  }

  return root;
}

schemaBuilderProto.drizzleObject = function drizzleObject(table, options) {
  return defineDrizzleType(this, table, options as never, 'Object') as never;
};

schemaBuilderProto.drizzleInterface = function drizzleInterface(table, options) {
  return defineDrizzleType(this, table, options as never, 'Interface') as never;
};

schemaBuilderProto.drizzleNode = function drizzleNode(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes> & {
    nodeInterfaceRef?: () => InterfaceRef<SchemaTypes, unknown>;
  },
  table: keyof SchemaTypes['DrizzleRelations']['config'],
  {
    id: { column, ...idOptions },
    name,
    variant,
    ...options
  }: DrizzleNodeOptions<
    SchemaTypes,
    keyof SchemaTypes['DrizzleRelations']['config'],
    {},
    {},
    [],
    Column
  >,
) {
  const schemaConfig = getSchemaConfig(this);
  const tableConfig = schemaConfig.relations[table];
  const idColumn = typeof column === 'function' ? column(tableConfig.table) : column;
  const idColumns = Array.isArray(idColumn) ? idColumn : [idColumn];
  const interfaceRef = this.nodeInterfaceRef?.();
  const typeName = variant ?? name ?? table;
  const resolve = getIDSerializer(idColumns, schemaConfig, typeName);
  const idParser = getIDParser(idColumns, schemaConfig, typeName);
  const nodeRef = new DrizzleNodeRef(typeName, table, {
    parseId: (id) => {
      const parsed = idParser(id);
      if (Array.isArray(idColumn)) {
        return parsed;
      }

      return parsed[schemaConfig.columnToTsName(idColumn)];
    },
  });
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
      let parsed: Record<string, unknown>;

      try {
        parsed = idParser(id);
      } catch (error) {
        // Returned rather than thrown: graphql reports an Error value as the error of its own
        // list item, so one bad ID fails only its entry of `nodes(ids:)`.
        return error;
      }

      const record = await modelLoader(context).loadSelectionForField(info, parsed, typeName);

      if (record) {
        brandWithType(record, typeName as OutputType<SchemaTypes>);
      }

      return record;
    },
  };

  const ref = defineDrizzleType(
    this,
    table,
    extendedOptions as never,
    'Object',
    'drizzleNode',
  ) as DrizzleObjectRef<SchemaTypes>;

  if (options.interfaces) {
    ref.addInterfaces(options.interfaces);
  }

  this.configStore.onTypeConfig(ref, (nodeConfig) => {
    this.objectField(
      ref,
      (this.options as { relay?: { idFieldName?: string } }).relay?.idFieldName ?? 'id',
      (t) =>
        (
          t as unknown as {
            globalID: (options: Record<string, unknown>) => FieldRef<SchemaTypes, unknown>;
          }
        ).globalID({
          ...(this.options as { relay?: { idFieldOptions?: object } }).relay?.idFieldOptions,
          ...idOptions,
          nullable: false,
          args: {},
          resolve: (parent: never) =>
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

/**
 * The body of `drizzleObjectField(s)` and `drizzleInterfaceField(s)`: they differ only in kind.
 * A table name names the interface registered under it, as `drizzleInterface` registers one.
 */
function addDrizzleFields(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: string | { tableName: string },
  fields: (t: DrizzleObjectFieldBuilder<SchemaTypes, TableRelationalConfig, {}>) => {},
  graphqlKind?: 'Interface',
) {
  const ref =
    typeof type === 'string'
      ? getRefFromModel(type, builder, graphqlKind ? 'interface' : 'object')
      : (type as never);

  builder.configStore.onTypeConfig(ref, ({ name }) => {
    builder.configStore.addFields(ref, () =>
      fields(new DrizzleObjectFieldBuilder(name, builder, ref.tableName, graphqlKind) as never),
    );
  });
}

schemaBuilderProto.drizzleObjectField = function drizzleObjectField(type, fieldName, field) {
  addDrizzleFields(this, type as never, (t) => ({ [fieldName]: field(t as never) }));
};

schemaBuilderProto.drizzleInterfaceField = function drizzleInterfaceField(type, fieldName, field) {
  addDrizzleFields(this, type as never, (t) => ({ [fieldName]: field(t as never) }), 'Interface');
};

schemaBuilderProto.drizzleObjectFields = function drizzleObjectFields(type, fields) {
  addDrizzleFields(this, type as never, fields as never);
};

schemaBuilderProto.drizzleInterfaceFields = function drizzleInterfaceFields(type, fields) {
  addDrizzleFields(this, type as never, fields as never, 'Interface');
};
