import './global-types';
import './schema-builder';
import SchemaBuilder, { BasePlugin, SchemaTypes } from '@pothos/core';

export * from './types';

const pluginName = 'withInput';

export default pluginName;

export class PothosWithInputPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin(pluginName, PothosWithInputPlugin);
