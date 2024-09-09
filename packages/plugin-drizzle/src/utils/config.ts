import { type SchemaTypes, createContextCache } from '@pothos/core';
import {
  type Column,
  type RelationalSchemaConfig,
  type TableRelationalConfig,
  type TablesRelationalConfig,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  getTableName,
} from 'drizzle-orm';
import type { DrizzleClient } from '../types';

export interface PothosDrizzleSchemaConfig extends RelationalSchemaConfig<TablesRelationalConfig> {
  dbToSchema: Record<string, TableRelationalConfig>;
  columnToTsName: (column: Column) => string;
}
const configCache = createContextCache(
  (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>): PothosDrizzleSchemaConfig => {
    let config: RelationalSchemaConfig<TablesRelationalConfig>;
    if (builder.options.drizzle.schema) {
      const tablesConfig = extractTablesRelationalConfig(
        builder.options.drizzle.schema,
        createTableRelationsHelpers,
      );
      config = {
        fullSchema: builder.options.drizzle.schema,
        schema: tablesConfig.tables,
        tableNamesMap: tablesConfig.tableNamesMap,
      };
    } else {
      config = (builder.options.drizzle.client as DrizzleClient)
        ._ as RelationalSchemaConfig<TablesRelationalConfig>;
    }

    const dbToSchema = Object.values(config.schema).reduce<Record<string, TableRelationalConfig>>(
      (acc, table) => {
        acc[table.dbName] = table;
        return acc;
      },
      {},
    );

    const columnMappings = Object.values(dbToSchema).reduce<Record<string, Record<string, string>>>(
      (acc, table) => {
        acc[table.dbName] = Object.entries(table.columns).reduce<Record<string, string>>(
          (acc, [name, column]) => {
            acc[column.name] = name;
            return acc;
          },
          {},
        );
        return acc;
      },
      {},
    );

    return {
      dbToSchema,
      columnToTsName: (column) => {
        const tableName = getTableName(column.table);
        const table = columnMappings[tableName];
        const columnName = table?.[column.name];

        if (!columnName) {
          throw new Error(`Could not find column mapping for ${tableName}.${column.name}`);
        }

        return columnName;
      },
      ...config,
    };
  },
);

const clientCache = createContextCache((builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) => {
  const clientConfig = builder.options.drizzle.client;
  const getClient =
    typeof clientConfig === 'function'
      ? createContextCache((ctx) => clientConfig(ctx))
      : (_ctx: object) => clientConfig;

  return createContextCache((context: object) => {
    const client = getClient(context);

    return client;
  });
});

export function getSchemaConfig<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  return configCache(builder as never);
}

export function getClient<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
) {
  return clientCache(builder as never)(context);
}
