// @ts-nocheck
import './global-types.ts';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import SchemaBuilder, { BasePlugin, PothosOutputFieldConfig, SchemaTypes } from '../core/index.ts';
import { TracingFieldOptions, TracingFieldWrapper } from './types.ts';
const pluginName = "tracing";
export default pluginName;
export * from './types.ts';
export * from './util.ts';
export class PothosTracingPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        if (!this.builder.options.tracing) {
            return resolver;
        }
        const { wrap, default: defaultConfig } = this.builder.options.tracing;
        const tracingValue = fieldConfig.pothosOptions.tracing ??
            (typeof defaultConfig === "function"
                ? (defaultConfig as (config: PothosOutputFieldConfig<Types>) => Types["Tracing"])(fieldConfig)
                : defaultConfig);
        return wrapResolver(fieldConfig, tracingValue, wrap, resolver);
    }
}
function wrapResolver<Types extends SchemaTypes>(fieldConfig: PothosOutputFieldConfig<Types>, tracingOptions: TracingFieldOptions<Types, unknown, object>, wrap: TracingFieldWrapper<Types>, resolver: GraphQLFieldResolver<unknown, Types["Context"], object>): GraphQLFieldResolver<unknown, Types["Context"], object> {
    if (tracingOptions === false || tracingOptions === null) {
        return resolver;
    }
    if (typeof tracingOptions === "function") {
        return (source, args, ctx, info) => {
            const options = (tracingOptions as (parent: unknown, Args: object, context: Types["Context"], info: GraphQLResolveInfo) => Types["Tracing"])(source, args, ctx, info);
            if (options === null || options === false) {
                return resolver(source, args, ctx, info);
            }
            return wrap(resolver, options as never, fieldConfig)(source, args as {}, ctx, info);
        };
    }
    return wrap(resolver, tracingOptions as never, fieldConfig) as GraphQLFieldResolver<unknown, Types["Context"], object>;
}
SchemaBuilder.registerPlugin(pluginName, PothosTracingPlugin);
