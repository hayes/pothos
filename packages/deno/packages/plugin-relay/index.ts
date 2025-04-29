// @ts-nocheck
import './global-types.ts';
import './field-builder.ts';
import './input-field-builder.ts';
import './schema-builder.ts';
import SchemaBuilder, { BasePlugin, createInputValueMapper, type InputTypeFieldsMapping, mapInputFields, type PartialResolveInfo, type PothosOutputFieldConfig, type SchemaTypes, } from '../core/index.ts';
import { internalDecodeGlobalID } from './utils/internal.ts';
export * from './node-ref.ts';
export * from './types.ts';
export * from './utils/index.ts';
const pluginName = "relay";
export default pluginName;
export class PothosRelayPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    private mappingCache = new Map<string, InputTypeFieldsMapping<Types, {
        typename: string;
        parseId: (id: string, ctx: object) => unknown;
    }[] | boolean>>();
    override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>): PothosOutputFieldConfig<Types> | null {
        const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (inputField) => {
            if (inputField.extensions?.isRelayGlobalID) {
                return (inputField.extensions?.relayGlobalIDFor ??
                    inputField.extensions?.relayGlobalIDAlwaysParse ??
                    false) as {
                    typename: string;
                    parseId: (id: string, ctx: object) => unknown;
                }[] | boolean;
            }
            return null;
        }, this.mappingCache);
        if (!argMappings) {
            return fieldConfig;
        }
        const argMapper = createInputValueMapper(argMappings, (globalID, mappings, ctx: Types["Context"], info: PartialResolveInfo) => internalDecodeGlobalID(this.builder, String(globalID), ctx, info, mappings.value ?? false));
        return {
            ...fieldConfig,
            argMappers: [
                ...(fieldConfig.argMappers ?? []),
                (args, context, info) => argMapper(args, undefined, context, info),
            ],
        };
    }
}
SchemaBuilder.registerPlugin(pluginName, PothosRelayPlugin, {
    v3: (options) => ({
        relayOptions: undefined,
        relay: {
            ...(options.relayOptions as {}),
            clientMutationId: options.relayOptions?.clientMutationId ?? "required",
            cursorType: options.relayOptions?.cursorType ?? "ID",
            edgeCursorType: options.relayOptions?.edgeCursorType ?? options.relayOptions?.cursorType ?? "String",
            pageInfoCursorType: options.relayOptions?.pageInfoCursorType ?? options.relayOptions?.cursorType ?? "String",
            edgesFieldOptions: {
                ...options.relayOptions.edgesFieldOptions,
                nullable: options.relayOptions.edgesFieldOptions?.nullable ?? { list: false, items: true },
            },
            nodeFieldOptions: {
                ...options.relayOptions.nodeFieldOptions,
                nullable: options.relayOptions.nodeFieldOptions?.nullable ?? false,
            },
            brandLoadedObjects: options.relayOptions.brandLoadedObjects ?? false,
        },
    }),
});
