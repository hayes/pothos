import './global-types.js';
import './field-builder.js';
import './input-field-builder.js';
import './schema-builder.js';
import { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  createInputValueMapper,
  GiraphQLOutputFieldConfig,
  mapInputFields,
  SchemaTypes,
} from '@giraphql/core';
import { internalDecodeGlobalID } from './utils/internal.js';

export * from './types.js';
export * from './utils/index.js';

const pluginName = 'relay';

export default pluginName;

export class GiraphQLRelayPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (inputField) => {
      if (inputField.extensions?.isRelayGlobalID) {
        return true;
      }

      return null;
    });

    if (!argMappings) {
      return resolver;
    }

    const argMapper = createInputValueMapper(argMappings, (globalID) =>
      internalDecodeGlobalID(this.builder, String(globalID)),
    );

    return (parent, args, context, info) =>
      resolver(parent, argMapper(args), context, info) as unknown;
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (inputField) => {
      if (inputField.extensions?.isRelayGlobalID) {
        return true;
      }

      return null;
    });

    if (!argMappings || !subscribe) {
      return subscribe;
    }

    const argMapper = createInputValueMapper(argMappings, (globalID) =>
      internalDecodeGlobalID(this.builder, String(globalID)),
    );

    return (parent, args, context, info) =>
      subscribe(parent, argMapper(args), context, info) as unknown;
  }
}

SchemaBuilder.registerPlugin(pluginName, GiraphQLRelayPlugin);
