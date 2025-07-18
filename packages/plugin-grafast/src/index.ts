import { access, type ObjectStep, type Step } from 'grafast';
import './global-types';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';

const pluginName = 'grafast' as const;

export default pluginName;

export class PothosGrafastPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig) {
    return typeConfig;
  }

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    let plan: typeof fieldConfig.pothosOptions.plan;

    if (fieldConfig.pothosOptions.plan) {
      plan = fieldConfig.pothosOptions.plan;
    } else if (fieldConfig.extensions?.pothosExposedField) {
      fieldConfig.resolve = undefined;
      plan = (step: ObjectStep<Record<string, Step>>) =>
        typeof step.get === 'function'
          ? step.get(fieldConfig.extensions!.pothosExposedField as string)
          : access(step, fieldConfig.extensions!.pothosExposedField as string);
    }

    if (plan) {
      fieldConfig.extensions = {
        ...fieldConfig.extensions,
        grafast: {
          ...(fieldConfig.extensions?.grafast ?? {}),
          plan,
        },
      };
    }

    return fieldConfig;
  }

  override beforeBuild() {}
}

SchemaBuilder.registerPlugin(pluginName, PothosGrafastPlugin);
