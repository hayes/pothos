import './global-types';
import './field-builder';
import './schema-builder';
import SchemaBuilder, { BasePlugin, BuildCache, SchemaTypes } from '@giraphql/core';

export * from './types';

const pluginName = 'prisma' as const;

export default pluginName;

export class PrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }
}

SchemaBuilder.registerPlugin(pluginName, PrismaPlugin);
