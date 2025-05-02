import { type SchemaTypes, createContextCache } from '@pothos/core';
import { type AnyRelations, type Column, type Table, getTableName } from 'drizzle-orm';
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

    const dbToSchema = Object.values(relations.tables).reduce<Record<string, Table>>(
      (acc, table) => {
        const tableName = getTableName(table);
        if (tableName) {
          acc[tableName] = table;
        }
        return acc;
      },
      {},
    );

    const columnMappings = Object.values(dbToSchema).reduce<Record<string, Record<string, string>>>(
      (acc, table) => {
        acc[getTableName(table)] = Object.entries(table).reduce<Record<string, string>>(
          (acc, [name, column]) => {
            acc[(column as Column).name] = name;
            return acc;
          },
          {},
        );
        return acc;
      },
      {},
    );

    return {
      skipDeferredFragments: builder.options.drizzle.skipDeferredFragments ?? true,
      columnToTsName: (column) => {
        const tableName = getTableName(column.table);
        const table = columnMappings[tableName];
        const columnName = table?.[column.name];

        if (!columnName) {
          throw new Error(`Could not find column mapping for ${tableName}.${column.name}`);
        }

        return columnName;
      },
      getPrimaryKey: (tableName) => {
        const tableConfig = builder.options.drizzle.getTableConfig(relations.tables[tableName]);

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
