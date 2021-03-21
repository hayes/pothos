import './global-types';
import SchemaBuilder, { BasePlugin, SchemaTypes } from '@giraphql/core';

const pluginName = 'zod' as const;

export class GiraphQLZodPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin(pluginName, GiraphQLZodPlugin);

export default pluginName;
