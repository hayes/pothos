import { get, type Step } from 'grafast';
import './global-types';
import SchemaBuilder, {
  BasePlugin,
  InterfaceRef,
  ObjectRef,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
  UnionRef,
} from '@pothos/core';
import type { AbstractTypePlanOptions, ObjectTypePlanOptions } from './types';

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
      plan = (step: Step) => get(step, fieldConfig.extensions!.pothosExposedField as string);
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

InterfaceRef.prototype.withPlan = function withPlan(
  this: InterfaceRef<SchemaTypes, unknown>,
  plan: AbstractTypePlanOptions<unknown, unknown>,
) {
  this.updateConfig((config) => ({
    ...config,
    extensions: {
      ...config.extensions,
      grafast: {
        ...config.extensions?.grafast,
        ...plan,
      },
    },
  }));
  return this;
};

UnionRef.prototype.withPlan = function withPlan(
  this: UnionRef<SchemaTypes, unknown>,
  plan: AbstractTypePlanOptions<unknown, unknown>,
) {
  this.updateConfig((config) => ({
    ...config,
    extensions: {
      ...config.extensions,
      grafast: {
        ...config.extensions?.grafast,
        ...plan,
      },
    },
  }));
  return this;
};

ObjectRef.prototype.withPlan = function withPlan(
  this: ObjectRef<SchemaTypes, unknown>,
  plan: ObjectTypePlanOptions<unknown, unknown>,
) {
  this.updateConfig((config) => ({
    ...config,
    extensions: {
      ...config.extensions,
      grafast: {
        ...config.extensions?.grafast,
        ...plan,
      },
    },
  }));
  return this;
};
