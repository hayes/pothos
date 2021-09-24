import './global-types';
import { GraphQLFieldResolver } from 'graphql';
import * as zod from 'zod';
import SchemaBuilder, {
  BasePlugin,
  GiraphQLInputFieldConfig,
  GiraphQLInputFieldType,
  GiraphQLOutputFieldConfig,
  mapInputFields,
  resolveInputTypeConfig,
  SchemaTypes,
} from '@giraphql/core';
import createZodSchema, {
  combine,
  createArrayValidator,
  isArrayValidator,
  refine,
} from './createZodSchema';
import { RefineConstraint, ValidationOptionUnion } from './types';

export * from './types';

export { createZodSchema };

const pluginName = 'validation' as const;

export class GiraphQLValidationPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  inputFieldValidators = new Map<string, Record<string, zod.ZodType<unknown>>>();

  inputTypeValidators = new Map<string, zod.ZodType<unknown>>();

  override onInputFieldConfig(
    fieldConfig: GiraphQLInputFieldConfig<Types>,
  ): GiraphQLInputFieldConfig<Types> {
    const fieldType = resolveInputTypeConfig(fieldConfig.type, this.buildCache);
    const validationOptions = fieldConfig.giraphqlOptions.validate as
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

    if (fieldConfig.kind === 'InputObject') {
      this.inputFieldValidators.set(fieldConfig.parentType, {
        ...this.inputFieldValidators.get(fieldConfig.parentType),
        [fieldConfig.name]: validator,
      });
    }

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
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    // Only used to check if validation is required
    const argMap = mapInputFields(
      fieldConfig.args,
      this.buildCache,
      (field) => field.giraphqlOptions.validate ?? null,
    );

    if (!argMap && !fieldConfig.giraphqlOptions.validate) {
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

    if (fieldConfig.giraphqlOptions.validate) {
      validator = refine(validator, {
        refine: fieldConfig.giraphqlOptions.validate as RefineConstraint<unknown>,
      });
    }

    return async (parent, rawArgs, context, info) =>
      resolver(parent, (await validator.parseAsync(rawArgs)) as object, context, info) as unknown;
  }

  createValidator(
    optionsOrConstraint: RefineConstraint | ValidationOptionUnion | undefined,
    type: GiraphQLInputFieldType<Types> | null,
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

      if (typeConfig.giraphqlOptions.validate) {
        fieldValidator = refine(fieldValidator, {
          refine: typeConfig.giraphqlOptions.validate as RefineConstraint<unknown>,
        });
      }

      return combine([fieldValidator], type.required);
    }

    if (type?.kind === 'List') {
      if (options && !isArrayValidator(options)) {
        throw new Error(`Expected valid array validator for ${fieldName}`);
      }

      const items = options?.items
        ? this.createValidator(options.items, type.type, fieldName)
        : zod.unknown();

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

SchemaBuilder.registerPlugin(pluginName, GiraphQLValidationPlugin);

export default pluginName;
