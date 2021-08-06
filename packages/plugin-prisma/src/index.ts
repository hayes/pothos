import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, { BasePlugin, BuildCache, SchemaTypes } from '@giraphql/core';

export * from './types.js';

const pluginName = 'prisma' as const;

export default pluginName;

export class PrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }
}

SchemaBuilder.registerPlugin(pluginName, PrismaPlugin);
