import './global-types';
import './schema-builder';
import SchemaBuilder, { BasePlugin, BuildCache, SchemaTypes } from '@pothos/core';

const pluginName = 'prismaCrud' as const;

export default pluginName;

export class PrismaCrudPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }
}

SchemaBuilder.registerPlugin(pluginName, PrismaCrudPlugin);
