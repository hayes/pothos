import './global-types';
import './schema-builder';
import SchemaBuilder, { BasePlugin, SchemaTypes } from '@giraphql/core';

const pluginName = 'inputObjects' as const;

export default pluginName;

export class GiraphQLInputObjectsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin(pluginName, GiraphQLInputObjectsPlugin);
