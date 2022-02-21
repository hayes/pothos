import './global-types';
import './field-builder';
import './schema-builder';
import SchemaBuilder, {
  BasePlugin,
  BuildCache,
  PothosOutputFieldConfig,
  SchemaTypes,
} from '@pothos/core';

export * from './types';

const pluginName = 'prisma' as const;

export default pluginName;

export class PrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    if (fieldConfig.kind === 'PrismaObject') {
      return {
        ...fieldConfig,
        extensions: {
          ...fieldConfig.extensions,
          pothosPrismaSelect: fieldConfig.pothosOptions.select,
        },
      };
    }

    return fieldConfig;
  }
}

SchemaBuilder.registerPlugin(pluginName, PrismaPlugin);
