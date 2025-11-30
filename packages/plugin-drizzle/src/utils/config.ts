import { createContextCache, type SchemaTypes } from '@pothos/core';
import {
  type AnyRelations,
  type Column,
  getColumnTable,
  getTableColumns,
  getTableName,
  isTable,
  type Table,
} from 'drizzle-orm';
import type { DrizzleClient } from '../types';

export interface PothosDrizzleSchemaConfig {
  skipDeferredFragments: boolean;
  relations: AnyRelations;
  getPrimaryKey: (tableName: string) => Column[];
  columnToTsName: (column: Column) => string;
}
const configCache = createContextCache(
  (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>): PothosDrizzleSchemaConfig => {
    let relations: AnyRelations;
    if (builder.options.drizzle.relations) {
      relations = builder.options.drizzle.relations;
    } else {
      relations = (builder.options.drizzle.client as DrizzleClient)._.relations;
    }

    // Map from (tableName, columnName) -> TypeScript property name
    // This is the only reliable way to resolve column names since:
    // - getColumnTable(column) always returns the table reference
    // - getTableName(table) always returns the table name
    // - column.name always contains the database column name
    const columnNameByTableAndName: Record<string, Record<string, string>> = {};

    Object.values(relations).forEach(({ table }) => {
      if (isTable(table)) {
        const tableName = getTableName(table);
        columnNameByTableAndName[tableName] = {};
        Object.entries(getTableColumns(table)).forEach(([tsName, col]) => {
          columnNameByTableAndName[tableName][col.name] = tsName;
        });
      }
    });

    return {
      skipDeferredFragments: builder.options.drizzle.skipDeferredFragments ?? true,
      columnToTsName: (column) => {
        // Use getColumnTable to get the table reference, then getTableName to get the name
        // Combined with column.name (the db column name), we can look up the TypeScript name
        const columnTable = getColumnTable(column);
        const tableName = getTableName(columnTable);
        const tableMapping = columnNameByTableAndName[tableName];

        if (tableMapping && column.name in tableMapping) {
          return tableMapping[column.name];
        }

        throw new Error(
          `Could not find TypeScript name for column ${String(column.name)} in table ${tableName}`,
        );
      },
      getPrimaryKey: (tableName) => {
        const tableConfig = builder.options.drizzle.getTableConfig(
          relations[tableName].table as Table,
        );

        const primaryKey = tableConfig.columns.find((column) => column.primary);

        if (primaryKey) {
          return [primaryKey];
        }

        const primaryKeys = tableConfig.primaryKeys.find((key) => key.columns.length > 0);

        if (primaryKeys) {
          return primaryKeys.columns;
        }

        const uniqueColumn = tableConfig.columns.find((column) => column.isUnique);

        if (uniqueColumn) {
          return [uniqueColumn];
        }

        throw new Error(`Could not find primary key for table ${tableName}`);
      },
      relations,
    };
  },
);

export const drizzleClientCache = createContextCache(
  (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) => {
    const clientConfig = builder.options.drizzle.client;
    const getClient =
      typeof clientConfig === 'function'
        ? createContextCache((ctx) => clientConfig(ctx))
        : (_ctx: object) => clientConfig;

    return createContextCache((context: object) => {
      const client = getClient(context);

      return client;
    });
  },
);

export function getSchemaConfig<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  return configCache(builder as never);
}

export function getClient<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
) {
  return drizzleClientCache(builder as never)(context);
}
