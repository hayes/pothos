// @ts-nocheck
import './global-types.ts';
import './schema-builder.ts';
import SchemaBuilder, { BasePlugin, SchemaTypes } from '../core/index.ts';
export * from './types.ts';
const pluginName = "withInput";
export default pluginName;
export class PothosWithInputPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
}
SchemaBuilder.registerPlugin(pluginName, PothosWithInputPlugin);
