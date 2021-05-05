import './global-types.ts';
import './field-builder.ts';
import './input-field-builder.ts';
import './schema-builder.ts';
import { GraphQLFieldResolver } from 'https://cdn.skypack.dev/graphql@v15.5.0?dts';
import SchemaBuilder, { BasePlugin, createInputValueMapper, GiraphQLOutputFieldConfig, mapInputFields, SchemaTypes, } from '../core/index.ts';
import { internalDecodeGlobalID } from './utils/internal.ts';
export * from './types.ts';
export * from './utils/index.ts';
const pluginName = "relay";
export default pluginName;
export class GiraphQLRelayPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: GiraphQLOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (inputField) => {
            if (inputField.extensions?.isRelayGlobalID) {
                return true;
            }
            return null;
        });
        if (!argMappings) {
            return resolver;
        }
        const argMapper = createInputValueMapper(argMappings, (globalID) => internalDecodeGlobalID(this.builder, String(globalID)));
        return (parent, args, context, info) => resolver(parent, argMapper(args), context, info) as unknown;
    }
    wrapSubscribe(subscribe: GraphQLFieldResolver<unknown, Types["Context"], object> | undefined, fieldConfig: GiraphQLOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> | undefined {
        const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (inputField) => {
            if (inputField.extensions?.isRelayGlobalID) {
                return true;
            }
            return null;
        });
        if (!argMappings || !subscribe) {
            return subscribe;
        }
        const argMapper = createInputValueMapper(argMappings, (globalID) => internalDecodeGlobalID(this.builder, String(globalID)));
        return (parent, args, context, info) => subscribe(parent, argMapper(args), context, info) as unknown;
    }
}
SchemaBuilder.registerPlugin(pluginName, GiraphQLRelayPlugin);
