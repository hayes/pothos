import './global-types';
import './schema-builder';
import SchemaBuilder, { BasePlugin, SchemaTypes } from '@pothos/core';

const pluginName = 'simpleObjects' as const;

export default pluginName;

export class PothosSimpleObjectsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override beforeBuild(): void {}
}

SchemaBuilder.registerPlugin(pluginName, PothosSimpleObjectsPlugin);
