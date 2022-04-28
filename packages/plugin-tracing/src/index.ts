import './global-types';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, { BasePlugin, PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';
import { TracingFieldOptions, TracingFieldWrapper } from './types';

const pluginName = 'tracing' as const;

export default pluginName;

export * from './types';
export * from './util';

export class PothosTracingPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (!this.builder.options.tracing) {
      return resolver;
    }

    const { wrap, default: defaultConfig } = this.builder.options.tracing;
    const tracingValue =
      fieldConfig.pothosOptions.tracing ??
      (typeof defaultConfig === 'function'
        ? (defaultConfig as (config: PothosOutputFieldConfig<Types>) => Types['Tracing'])(
            fieldConfig,
          )
        : defaultConfig);

    return wrapResolver(fieldConfig, tracingValue, wrap, resolver);
  }
}

export function wrapResolver<Types extends SchemaTypes>(
  fieldConfig: PothosOutputFieldConfig<Types>,
  tracingOptions: TracingFieldOptions<Types, unknown, Record<string, unknown>>,
  wrap: TracingFieldWrapper<Types>,
  resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
): GraphQLFieldResolver<unknown, Types['Context'], object> {
  if (tracingOptions === false || tracingOptions === null) {
    return resolver;
  }

  if (typeof tracingOptions === 'function') {
    return (source, args, ctx, info) => {
      const options = (
        tracingOptions as (
          parent: unknown,
          Args: object,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => Types['Tracing']
      )(source, args, ctx, info);

      if (options === null || options === false) {
        return resolver(source, args, ctx, info);
      }
      const wrapper = wrap(fieldConfig, options as never);

      if (!wrapper) {
        return resolver(source, args, ctx, info);
      }

      return wrapper(
        () => resolver(source, args, ctx, info),
        options as never,
        source,
        args as Record<string, unknown>,
        ctx,
        info,
      );
    };
  }

  const wrapper = wrap(fieldConfig, tracingOptions as never);

  if (!wrapper) {
    return resolver;
  }

  return (source, args, context, info) =>
    wrapper(
      () => resolver(source, args, context, info),
      tracingOptions as never,
      source,
      args as {},
      context,
      info,
    );
}

SchemaBuilder.registerPlugin(pluginName, PothosTracingPlugin);
