import { type AbstractTypePlanner, get, type Step } from 'grafast';
import './global-types';
import SchemaBuilder, {
  BasePlugin,
  InterfaceRef,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
  UnionRef,
} from '@pothos/core';

const pluginName = 'grafast' as const;

export default pluginName;

export class PothosGrafastPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig) {
    return typeConfig;
  }

  // @ts-ignore since we need to access resolve here (maybe caused by MergeUnion)
  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types & { InferredFieldOptionsKind: 'Grafast' }>,
  ) {
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

SchemaBuilder.registerPlugin(pluginName, PothosGrafastPlugin as never);

InterfaceRef.prototype.withPlan = function withPlan(
  this: InterfaceRef<SchemaTypes, unknown>,
  planType: ($stepOrSpecifier: Step) => AbstractTypePlanner,
) {
  this.updateConfig((config) => ({
    ...config,
    extensions: {
      ...config.extensions,
      grafast: {
        ...config.extensions?.grafast,
        planType,
      },
    },
  }));
  return this;
};

UnionRef.prototype.withPlan = function withPlan(
  this: UnionRef<SchemaTypes, unknown>,
  planType: ($stepOrSpecifier: Step) => AbstractTypePlanner,
) {
  this.updateConfig((config) => ({
    ...config,
    extensions: {
      ...config.extensions,
      grafast: {
        ...config.extensions?.grafast,
        planType,
      },
    },
  }));
  return this;
};
