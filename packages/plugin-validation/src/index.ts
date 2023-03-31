import './global-types';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import * as zod from 'zod';
import SchemaBuilder, {
  BasePlugin,
  mapInputFields,
  PothosInputFieldConfig,
  PothosInputFieldType,
  PothosOutputFieldConfig,
  PothosSchemaError,
  PothosValidationError,
  resolveInputTypeConfig,
  SchemaTypes,
} from '@pothos/core';
import createZodSchema, {
  combine,
  createArrayValidator,
  isArrayValidator,
  refine,
} from './createZodSchema';
import { RefineConstraint, ValidationOptions, ValidationOptionUnion } from './types';

export * from './types';

const pluginName = 'validation';

export class PothosValidationPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  inputFieldValidators = new Map<string, Record<string, zod.ZodType<unknown>>>();

  override onInputFieldConfig(
    fieldConfig: PothosInputFieldConfig<Types>,
  ): PothosInputFieldConfig<Types> {
    const fieldType = resolveInputTypeConfig(fieldConfig.type, this.buildCache);
    const validationOptions = fieldConfig.pothosOptions.validate as
      | ValidationOptionUnion
      | undefined;

    if (!validationOptions && fieldType.kind !== 'InputObject') {
      return fieldConfig;
    }

    const fieldName =
      fieldConfig.kind === 'Arg'
        ? `${fieldConfig.parentType}.${fieldConfig.parentField}(${fieldConfig.name})`
        : `${fieldConfig.parentType}.${fieldConfig.name}`;

    const validator = this.createValidator(validationOptions, fieldConfig.type, fieldName);

    if (fieldConfig.kind === 'Arg') {
      return {
        ...fieldConfig,
        extensions: {
          ...fieldConfig.extensions,
          validator,
        },
      };
    }

    this.inputFieldValidators.set(fieldConfig.parentType, {
      ...this.inputFieldValidators.get(fieldConfig.parentType),
      [fieldConfig.name]: validator,
    });

    return fieldConfig;
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    // Only used to check if validation is required
    const argMap = mapInputFields(
      fieldConfig.args,
      this.buildCache,
      (field) => field.extensions?.validator ?? null,
    );

    if (!argMap && !fieldConfig.pothosOptions.validate) {
      return resolver;
    }

    const args: Record<string, zod.ZodType<unknown>> = {};

    Object.keys(fieldConfig.args).forEach((argName) => {
      const validator = fieldConfig.args[argName].extensions?.validator as
        | zod.ZodType<unknown>
        | undefined;

      if (validator) {
        args[argName] = validator;
      }
    });

    let validator: zod.ZodTypeAny = zod.object(args).passthrough();

    if (fieldConfig.pothosOptions.validate) {
      validator = refine(validator, fieldConfig.pothosOptions.validate as ValidationOptionUnion);
    }

    const validationError = this.builder.options.validation?.validationError;

    const validatorWithErrorHandling =
      validationError &&
      async function validate(value: unknown, ctx: object, info: GraphQLResolveInfo) {
        try {
          const result: unknown = await validator.parseAsync(value);

          return result;
        } catch (error: unknown) {
          const errorOrMessage = validationError(
            error as zod.ZodError,
            value as Record<string, unknown>,
            ctx,
            info,
          );

          if (typeof errorOrMessage === 'string') {
            throw new PothosValidationError(errorOrMessage);
          }

          throw errorOrMessage;
        }
      };

    return async (parent, rawArgs, context, info) =>
      resolver(
        parent,
        (await (validatorWithErrorHandling
          ? validatorWithErrorHandling(rawArgs, context, info)
          : validator.parseAsync(rawArgs))) as object,
        context,
        info,
      );
  }

  createValidator(
    optionsOrConstraint: RefineConstraint | ValidationOptionUnion | undefined,
    type: PothosInputFieldType<Types> | null,
    fieldName: string,
  ): zod.ZodTypeAny {
    const options: ValidationOptionUnion | undefined =
      Array.isArray(optionsOrConstraint) || typeof optionsOrConstraint === 'function'
        ? { refine: optionsOrConstraint }
        : optionsOrConstraint;

    if (type?.kind === 'InputObject') {
      const typeConfig = this.buildCache.getTypeConfig(type.ref, 'InputObject');

      let fieldValidator = refine(
        zod.lazy(() =>
          zod.object(this.inputFieldValidators.get(typeConfig.name) ?? {}).passthrough(),
        ),
        options,
      );

      if (typeConfig.pothosOptions.validate) {
        fieldValidator = refine(
          fieldValidator,
          typeConfig.pothosOptions.validate as ValidationOptions<unknown>,
        );
      }

      return combine([fieldValidator], type.required);
    }

    if (type?.kind === 'List') {
      if (options && !isArrayValidator(options)) {
        throw new PothosSchemaError(`Expected valid array validator for ${fieldName}`);
      }

      const items = this.createValidator(options?.items, type.type, fieldName);

      if (options) {
        return combine([createArrayValidator(options, items)], type.required);
      }

      return combine([items.array()], type.required);
    }

    if (!options) {
      return zod.unknown();
    }

    return createZodSchema(options, !type || type.required);
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosValidationPlugin, {
  v3(options) {
    return {
      validationOptions: undefined,
      validation: options.validationOptions,
    };
  },
});

export default pluginName;

export { default as createZodSchema } from './createZodSchema';
