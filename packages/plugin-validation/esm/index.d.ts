import './global-types.js';
import './methods.js';
import { BasePlugin, type PothosInputFieldConfig, type SchemaTypes, type PothosOutputFieldConfig } from '@pothos/core';
export * from './types.js';
declare const pluginName = "validation";
export declare class PothosZodPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>): PothosInputFieldConfig<Types>;
    onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>): PothosOutputFieldConfig<Types> | null;
}
export default pluginName;
//# sourceMappingURL=index.d.ts.map
