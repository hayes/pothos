import SchemaBuilder, {
  BasePlugin,
  createInputValueMapper,
  type InputTypeFieldsMapping,
  mapInputFields,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver } from 'graphql';

declare global {
  namespace PothosSchemaTypes {
    interface Plugins<Types extends SchemaTypes> {
      architectureTrim: TrimPlugin<Types>;
    }
  }
}

// #region mapping
export class TrimPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  // Safe to share: selection depends only on input-field extensions, not its enclosing output field.
  private mappingCache = new Map<string, InputTypeFieldsMapping<Types, boolean>>();

  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const argMappings = mapInputFields(
      fieldConfig.args,
      this.buildCache,
      (inputField) => (inputField.extensions?.trimInput ? true : null),
      this.mappingCache,
    );
    if (!argMappings) {
      return resolver;
    }
    const argMapper = createInputValueMapper(argMappings, (value) =>
      typeof value === 'string' ? value.trim() : value,
    );
    return (parent, args, context, info) => resolver(parent, argMapper(args), context, info);
  }
}
// #endregion mapping

export const pluginName = 'architectureTrim';
SchemaBuilder.registerPlugin(pluginName, TrimPlugin);
