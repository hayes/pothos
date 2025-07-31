import './global-types';
import './methods';
import SchemaBuilder, {
  BasePlugin,
  mapInputFields,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  PothosValidationError,
  type SchemaTypes,
  unwrapInputFieldType,
} from '@pothos/core';
import { InputValidationError } from './errors';
import type { StandardSchemaV1 } from './standard-schema';
import { createArgsValidator } from './utils';

export * from './types';

const pluginName = 'validation';

export class PothosValidationPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onInputFieldConfig(
    fieldConfig: PothosInputFieldConfig<Types>,
  ): PothosInputFieldConfig<Types> {
    const extensions = fieldConfig.extensions ?? {};

    const existingSchemas = extensions['@pothos/plugin-validation']?.schemas ?? [];
    const optionsSchema = fieldConfig.pothosOptions.validate;

    if (optionsSchema || existingSchemas.length > 0) {
      return {
        ...fieldConfig,
        extensions: {
          ...extensions,
          '@pothos/plugin-validation': {
            ...extensions['@pothos/plugin-validation'],
            schemas: optionsSchema ? [optionsSchema, ...existingSchemas] : existingSchemas,
          },
        },
      };
    }

    return fieldConfig;
  }

  override onTypeConfig(typeConfig: PothosTypeConfig) {
    if (typeConfig.graphqlKind === 'InputObject') {
      const extensions = (typeConfig.extensions ?? {}) as {
        validationSchemas?: StandardSchemaV1[];
      };

      const existingSchemas = extensions.validationSchemas ?? [];
      const optionsSchema = typeConfig.pothosOptions.validate;

      if (optionsSchema || existingSchemas.length > 0) {
        return {
          ...typeConfig,
          extensions: {
            ...extensions,
            '@pothos/plugin-validation': {
              schemas: optionsSchema ? [optionsSchema, ...existingSchemas] : existingSchemas,
            },
          },
        };
      }
    }

    return typeConfig;
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    const argsSchema = fieldConfig.pothosOptions.validate ?? null;

    const argsSchemas = new Set(
      Object.values(fieldConfig.args).flatMap(
        (arg) => arg.extensions?.['@pothos/plugin-validation']?.parentSchemas ?? [],
      ),
    );

    const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (field) => {
      const chainedSchemas = field.extensions?.['@pothos/plugin-validation']?.schemas ?? [];
      const optionsSchema = field.pothosOptions.validate;
      const fieldSchemas = optionsSchema
        ? [...chainedSchemas.slice().reverse(), optionsSchema]
        : chainedSchemas.slice().reverse();

      const fieldTypeName = unwrapInputFieldType(field.type);
      const typeConfig = this.buildCache.getTypeConfig(fieldTypeName);

      const typeSchemas =
        typeConfig.kind === 'InputObject'
          ? (typeConfig.extensions?.['@pothos/plugin-validation']?.schemas ?? null)
          : null;

      return fieldSchemas.length > 0 || typeSchemas
        ? {
            fieldSchemas,
            typeSchemas: typeSchemas ?? [],
          }
        : null;
    });

    // Convert Set to Array and combine with argsSchema
    const allArgsSchemas = [...(argsSchema ? [argsSchema] : []), ...Array.from(argsSchemas)];

    if (!argMappings && allArgsSchemas.length === 0) {
      return fieldConfig;
    }

    const argValidator = createArgsValidator(argMappings, allArgsSchemas, {
      validationError: (failure, args, context) => {
        const validationErrorFn = this.builder.options.validation?.validationError;
        const error = validationErrorFn
          ? validationErrorFn(failure, args, context)
          : new InputValidationError(failure);

        if (typeof error === 'string') {
          throw new PothosValidationError(error);
        }

        throw error;
      },
    });

    return {
      ...fieldConfig,
      argMappers: [
        ...(fieldConfig.argMappers ?? []),
        (args, ctx, info) => argValidator(args, ctx, info),
      ],
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosValidationPlugin);

export default pluginName;
