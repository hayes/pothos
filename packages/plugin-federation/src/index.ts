import './global-types';
import { defaultFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  PothosEnumValueConfig,
  PothosInputFieldConfig,
  PothosOutputFieldConfig,
  PothosTypeConfig,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import { providesMap } from './external-ref';
import { entityMapping } from './schema-builder';
import { keyDirective, mergeDirectives } from './util';

export * from './types';

const pluginName = 'federation';

export default pluginName;

export class PothosFederationPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig) {
    const commonDirectives = getCommonDirectives(typeConfig);
    const entityConfig = entityMapping.get(this.builder)?.get(typeConfig.name);

    const apollo = entityConfig
      ? {
          ...(typeConfig.extensions?.apollo as {}),
          subgraph: {
            ...(typeConfig.extensions?.apollo as { subgraph: {} })?.subgraph,
            resolveReference: entityConfig.resolveReference,
          },
        }
      : typeConfig.extensions?.apollo;

    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        apollo,
        directives: mergeDirectives(typeConfig.extensions?.directives as [], [
          ...(entityConfig ? keyDirective(entityConfig.key) : []),
          ...commonDirectives,
          ...(entityConfig?.interfaceObject ? [{ name: 'interfaceObject', args: {} }] : []),
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

    const commonDirectives = getCommonDirectives(fieldConfig);

    const directives = mergeDirectives(
      fieldConfig.extensions?.directives as [],
      [
        options.requires
          ? { name: 'requires', args: { fields: options.requires.selection } }
          : null,
        fieldConfig.kind === 'ExternalEntity' ? { name: 'external' } : null,
        providesMap.has(ref) ? { name: 'provides', args: { fields: providesMap.get(ref) } } : null,
        fieldConfig.pothosOptions.override
          ? { name: 'override', args: fieldConfig.pothosOptions.override }
          : null,
        ...commonDirectives,
      ].filter(Boolean) as { name: string }[],
    );

    return {
      ...fieldConfig,
      resolve,
      extensions: {
        ...fieldConfig.extensions,
        directives,
      },
    };
  }

  override onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>) {
    return addCommonDirectives(fieldConfig);
  }

  override onEnumValueConfig(valueConfig: PothosEnumValueConfig<Types>) {
    return addCommonDirectives(valueConfig);
  }
}

function getCommonDirectives<
  T extends {
    extensions?: Record<string, unknown> | null;
    pothosOptions: {
      tag?: string | string[];
      inaccessible?: boolean;
      shareable?: boolean;
    };
  },
>(config: T) {
  const tags =
    typeof config.pothosOptions.tag === 'string'
      ? [config.pothosOptions.tag]
      : config.pothosOptions.tag ?? [];
  const tagDirectives = tags.map((tag) => ({ name: 'tag', args: { name: tag } }));

  return [
    config.pothosOptions.inaccessible ? { name: 'inaccessible' } : null,
    config.pothosOptions.shareable ? { name: 'shareable' } : null,
    ...tagDirectives,
  ].filter(Boolean) as { name: string }[];
}

function addCommonDirectives<
  T extends {
    extensions?: Record<string, unknown> | null;
    pothosOptions: {
      tag?: string | string[];
      inaccessible?: boolean;
    };
  },
>(config: T): T {
  const directives = mergeDirectives(
    config.extensions?.directives as [],
    getCommonDirectives(config),
  );

  return {
    ...config,
    extensions: {
      ...config.extensions,
      directives,
    },
  };
}

SchemaBuilder.registerPlugin(pluginName, PothosFederationPlugin);
