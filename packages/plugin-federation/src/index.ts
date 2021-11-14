import './global-types';
import SchemaBuilder, {
  BasePlugin,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { entityMapping, keyDirective, mergeDirectives } from './schema-builder';

export * from './types';

const pluginName = 'federation';

export default pluginName;

export class GiraphQLFederationPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    const entityConfig = entityMapping.get(this.builder)?.get(typeConfig.name);

    if (!entityConfig) {
      return typeConfig;
    }

    return {
      ...typeConfig,
      extensions: {
        resolveReference: entityConfig.resolveReference,
        ...typeConfig.extensions,
        directives: mergeDirectives(typeConfig.extensions?.directives as [], [
          ...keyDirective(entityConfig.key),
        ]),
      },
    };
  }

  override onOutputFieldConfig(
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GiraphQLOutputFieldConfig<Types> | null {
    const options = fieldConfig.giraphqlOptions as
      | GiraphQLSchemaTypes.FieldOptionsByKind<
          Types,
          unknown,
          TypeParam<Types>,
          false,
          {},
          {},
          {}
        >['ExtendedEntity'];

    return {
      ...fieldConfig,
      extensions: {
        ...fieldConfig.extensions,
        directives: mergeDirectives(fieldConfig.extensions?.directives as [], [
          ...(options.requires
            ? [{ name: 'requires', args: { fields: options.requires.selection } }]
            : []),
          ...(fieldConfig.kind === 'ExternalEntity' ? [{ name: 'external' }] : []),
        ]),
      },
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, GiraphQLFederationPlugin);
