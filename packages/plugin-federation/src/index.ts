import './global-types';
import { defaultFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  PothosOutputFieldConfig,
  PothosTypeConfig,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import { providesMap } from './external-ref';
import { entityMapping, keyDirective, mergeDirectives } from './schema-builder';

export * from './types';

const pluginName = 'federation';

export default pluginName;

export class PothosFederationPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig) {
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
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    const options = fieldConfig.pothosOptions as
      | PothosSchemaTypes.FieldOptionsByKind<
          Types,
          unknown,
          TypeParam<Types>,
          false,
          {},
          {},
          {}
        >['ExtendedEntity'];

    const ref = Array.isArray(options.type) ? options.type[0] : options.type;
    const resolve = (
      fieldConfig.kind === 'ExternalEntity' ? (defaultFieldResolver as never) : fieldConfig.resolve
    )!;

    const directives = mergeDirectives(fieldConfig.extensions?.directives as [], [
      ...(options.requires
        ? [{ name: 'requires', args: { fields: options.requires.selection } }]
        : []),
      ...(fieldConfig.kind === 'ExternalEntity' ? [{ name: 'external' }] : []),
      ...(providesMap.has(ref)
        ? [{ name: 'provides', args: { fields: providesMap.get(ref) } }]
        : []),
    ]);

    return {
      ...fieldConfig,
      resolve,
      extensions: {
        ...fieldConfig.extensions,
        directives,
      },
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosFederationPlugin);
