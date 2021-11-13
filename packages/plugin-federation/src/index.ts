import './global-types';
import SchemaBuilder, {
  BasePlugin,
  GiraphQLOutputFieldConfig,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { mergeDirectives } from './schema-builder';

export * from './types';

const pluginName = 'federation';

export default pluginName;

export class GiraphQLFederationPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
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
