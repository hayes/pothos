import './global-types';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '../../../src';

const pluginName = 'test';

export default pluginName;

export class PothosResolve2Plugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (fieldConfig.pothosOptions.resolve2) {
      return {
        ...fieldConfig,
        resolve: fieldConfig.pothosOptions.resolve2,
      };
    }

    return fieldConfig;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosResolve2Plugin);
