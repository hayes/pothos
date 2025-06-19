import './global-types';
import './methods';
import SchemaBuilder, {
  BasePlugin,
  mapInputFields,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type SchemaTypes,
  unwrapInputFieldType,
} from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema';
import { createArgsValidator } from './utils';

export * from './types';

const pluginName = 'validation';

export class PothosZodPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onInputFieldConfig(
    fieldConfig: PothosInputFieldConfig<Types>,
  ): PothosInputFieldConfig<Types> {
    if (fieldConfig.pothosOptions.validate) {
      const extensions = (fieldConfig.extensions ?? {}) as {
        validationSchemas?: StandardSchemaV1[];
      };

      return {
        ...fieldConfig,
        extensions: {
          ...extensions,
          validationSchemas: [
            ...(extensions.validationSchemas ?? []),
            fieldConfig.pothosOptions.validate,
          ],
        },
      };
    }

    return fieldConfig;
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    const argsSchema = fieldConfig.pothosOptions.validate ?? null;
    const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (field) => {
      const fieldSchemas = (field.extensions?.validationSchemas as StandardSchemaV1[]) ?? null;
      const fieldTypeName = unwrapInputFieldType(field.type);
      const typeSchemas =
        (this.buildCache.getTypeConfig(fieldTypeName).extensions
          ?.validationSchemas as StandardSchemaV1[]) ?? null;

      return fieldSchemas || typeSchemas
        ? {
            fieldSchemas,
            typeSchemas,
          }
        : null;
    });

    if (!argMappings && !argsSchema) {
      return fieldConfig;
    }

    const argValidator = createArgsValidator(argMappings, argsSchema);

    return {
      ...fieldConfig,
      argMappers: [...(fieldConfig.argMappers ?? []), (args) => argValidator(args)],
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosZodPlugin);

export default pluginName;
