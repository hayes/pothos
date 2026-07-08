import './global-types.js';
import './schema-builder.js';
import SchemaBuilder, { BasePlugin, type SchemaTypes } from '@pothos/core';

export * from './types.js';

const pluginName = 'withInput';

export default pluginName;

export class PothosWithInputPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin(pluginName, PothosWithInputPlugin);
