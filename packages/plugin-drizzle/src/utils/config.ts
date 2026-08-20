import { createContextCache, type SchemaTypes } from '@pothos/core';
import { type AnyRelations, type Column, getColumns, isTable, type Table } from 'drizzle-orm';
import type { DrizzleClient } from '../types.js';

export interface PothosDrizzleSchemaConfig {
  skipDeferredFragments: boolean;
  relations: AnyRelations;
  findPrimaryKey: (tableName: string) => Column[] | null;
  getPrimaryKey: (tableName: string) => Column[];
  getUniqueConstraints: (tableName: string) => Column[][];
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

    const columnNameMappings = new Map<Column, string>();

    Object.values(relations).forEach(({ table }) => {
      if (isTable(table)) {
        Object.entries(getColumns(table)).forEach(([tsName, col]) => {
          columnNameMappings.set(col, tsName);
        });
      }
    });

    const tableConfigs = new Map<string, ReturnType<typeof buildTableConfig>>();

    const buildTableConfig = (tableName: string) => {
      const table = relations[tableName].table as Table;
      const tableConfig = builder.options.drizzle.getTableConfig(table);
      const tableColumns = Object.values(getColumns(table));

      // The pg dialect builds primaryKeys and uniqueConstraints from
      // ExtraConfigColumns rather than the table's own columns, so the objects
      // it hands back are not the ones columnNameMappings knows about, and do
      // not carry notNull. Look each one back up by name.
      const toTableColumn = (column: Column) =>
        tableColumns.find((candidate) => candidate.name === column.name) ?? column;

      return {
        columns: tableConfig.columns.map(toTableColumn),
        primaryKeys: tableConfig.primaryKeys.map((key) => key.columns.map(toTableColumn)),
        uniqueConstraints: (tableConfig.uniqueConstraints ?? []).map((constraint) =>
          constraint.columns.map(toTableColumn),
        ),
      };
    };

    // drizzle rebuilds this from the table's config callback on every call
    const getTableConfig = (tableName: string) => {
      let tableConfig = tableConfigs.get(tableName);

      if (!tableConfig) {
        tableConfig = buildTableConfig(tableName);
        tableConfigs.set(tableName, tableConfig);
      }

      return tableConfig;
    };

    // Every set of columns the database guarantees is unique. Unique indexes
    // are not included: missing one only costs a redundant order column, while
    // wrongly reporting a set as unique would break pagination.
    const getUniqueConstraints = (tableName: string) => {
      const tableConfig = getTableConfig(tableName);

      return [
        ...tableConfig.columns
          .filter((column) => column.primary || column.isUnique)
          .map((column) => [column]),
        ...tableConfig.primaryKeys,
        ...tableConfig.uniqueConstraints,
      ].filter((columns) => columns.length > 0);
    };

    const findPrimaryKey = (tableName: string) => {
      const tableConfig = getTableConfig(tableName);

      const primaryKey = tableConfig.columns.find((column) => column.primary);

      if (primaryKey) {
        return [primaryKey];
      }

      const primaryKeys = tableConfig.primaryKeys.find((columns) => columns.length > 0);

      if (primaryKeys) {
        return primaryKeys;
      }

      const uniqueColumn = tableConfig.columns.find((column) => column.isUnique);

      if (uniqueColumn) {
        return [uniqueColumn];
      }

      return null;
    };

    return {
      skipDeferredFragments: builder.options.drizzle.skipDeferredFragments ?? true,
      columnToTsName: (column) => {
        const tsName = columnNameMappings.get(column);

        if (!tsName) {
          throw new Error(`Typescript name not found for column ${String(column.name)}`);
        }

        return tsName;
      },
      findPrimaryKey,
      getUniqueConstraints,
      getPrimaryKey: (tableName) => {
        const primaryKey = findPrimaryKey(tableName);

        if (!primaryKey) {
          throw new Error(`Could not find primary key for table ${tableName}`);
        }

        return primaryKey;
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
