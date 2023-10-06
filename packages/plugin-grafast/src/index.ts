/* eslint-disable no-param-reassign */
import './global-types';
import { access } from 'grafast';
import SchemaBuilder, {
  BasePlugin,
  PothosOutputFieldConfig,
  PothosTypeConfig,
  SchemaTypes,
} from '@pothos/core';

const pluginName = 'grafast' as const;

export default pluginName;

export class PothosGrafastPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig) {
    return typeConfig;
  }

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    let plan;

    if (fieldConfig.pothosOptions.plan) {
      // eslint-disable-next-line prefer-destructuring
      plan = fieldConfig.pothosOptions.plan;
    } else if (fieldConfig.extensions?.pothosExposedField) {
      fieldConfig.resolve = undefined;
      plan = (step: unknown) =>
        typeof step.get === 'function'
          ? step.get(fieldConfig.extensions!.pothosExposedField as string)
          : access(step, fieldConfig.extensions!.pothosExposedField as string);
    }

    if (plan) {
      fieldConfig.extensions = {
        ...fieldConfig.extensions,
        graphile: {
          ...(fieldConfig.extensions?.graphile ?? {}),
          plan,
        },
      };
    }

    return fieldConfig;
  }

  override beforeBuild() {}
}

SchemaBuilder.registerPlugin(pluginName, PothosGrafastPlugin);
