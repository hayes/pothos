import './global-types';
import SchemaBuilder, {
  BasePlugin,
  type PothosEnumValueConfig,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import { GraphQLSchema } from 'graphql';

// #region builder-method
const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
schemaBuilderProto.buildCustomObject = function buildCustomObject() {
  return this.objectRef<{ custom: 'shape' }>('CustomObject').implement({
    fields: (t) => ({ custom: t.exposeString('custom') }),
  });
};
// #endregion builder-method

export class HooksPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onTypeConfig(typeConfig: PothosTypeConfig) {
    // #region constructor-options
    const label = this.builder.options.nestedOptionsObject?.exampleOption;
    const rootOption = this.builder.options.optionInRootOfConfig;
    // #endregion constructor-options
    // #region build-options
    const buildOption = this.options.customBuildTimeOptions;
    // #endregion build-options
    // #region type-options
    if (typeConfig.kind === 'Object' && typeConfig.pothosOptions.optionOnObject) {
      return {
        ...typeConfig,
        description: `${label}; root=${rootOption}; build=${buildOption}`,
      };
    }
    return typeConfig;
    // #endregion type-options
  }

  // #region field-options
  onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (fieldConfig.name === 'removeMe') {
      return null;
    }
    if (fieldConfig.kind === 'Mutation' && fieldConfig.pothosOptions.customMutationFieldOption) {
      return { ...fieldConfig, description: 'Configured mutation' };
    }
    return fieldConfig;
  }
  // #endregion field-options

  // #region remove-input-enum
  onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>) {
    return fieldConfig.name === 'removeMe' ? null : fieldConfig;
  }

  onEnumValueConfig(valueConfig: PothosEnumValueConfig<Types>) {
    return valueConfig.value === 'removeMe' ? null : valueConfig;
  }
  // #endregion remove-input-enum

  // #region before-build
  beforeBuild() {
    this.runUnique('architecture-added-field', () => {
      console.log('Preparing schema once per builder');
    });
  }
  // #endregion before-build

  // #region after-build
  afterBuild(schema: GraphQLSchema) {
    return new GraphQLSchema({
      ...schema.toConfig(),
      description: 'Schema transformed after build',
    });
  }
  // #endregion after-build
}

export const pluginName = 'architectureHooks';
SchemaBuilder.registerPlugin(pluginName, HooksPlugin);
