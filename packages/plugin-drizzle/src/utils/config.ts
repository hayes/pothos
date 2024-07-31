import { createContextCache, SchemaTypes } from '@pothos/core';
import { RelationalSchemaConfig, TableRelationalConfig, TablesRelationalConfig } from 'drizzle-orm';

export interface PothosDrizzleSchemaConfig extends RelationalSchemaConfig<TablesRelationalConfig> {
  dbToSchema: Record<string, TableRelationalConfig>;
}
const cache = createContextCache(
  (config: RelationalSchemaConfig<TablesRelationalConfig>): PothosDrizzleSchemaConfig => {
    const dbToSchema = Object.values(config.schema).reduce<Record<string, TableRelationalConfig>>(
      (acc, table) => {
        acc[table.dbName] = table;
        return acc;
      },
      {},
    );

    return {
      dbToSchema,
      ...config,
    };
  },
);

export function getSchemaConfig<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  return cache(builder.options.drizzle.client._ as RelationalSchemaConfig<TablesRelationalConfig>);
}
