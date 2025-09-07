import { createContextCache, type SchemaTypes } from '@pothos/core';
import { type AnyRelations, type Column, getTableColumns, isTable, type Table } from 'drizzle-orm';
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

    const columnNameMappings: Record<string, string> = {};

    Object.values(relations).forEach(({ table }) => {
      if (isTable(table)) {
        Object.entries(getTableColumns(table)).forEach(([tsName, col]) => {
          if (col.uniqueName) {
            columnNameMappings[col.uniqueName] = tsName;
          }
        });
      }
    });

    return {
      skipDeferredFragments: builder.options.drizzle.skipDeferredFragments ?? true,
      columnToTsName: (column) => {
        if (!column.uniqueName) {
          throw new Error(`Column ${String(column.name)} has no uniqueName`);
        }

        if (!(column.uniqueName in columnNameMappings)) {
          throw new Error(`Typescript name not found for ${column.uniqueName}`);
        }

        return columnNameMappings[column.uniqueName];
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
