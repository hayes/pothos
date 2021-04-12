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
import {
  ArrayValidationOptions,
  BaseValidationOptions,
  BigIntValidationOptions,
  NumberValidationOptions,
  ObjectValidationOptions,
  StringValidationOptions,
  ValidationOptionUnion,
} from './types';

export * from './types';

const pluginName = 'validation' as const;

const baseValidations = ['refine'] as const;
const numberValidations = [
  'refine',
  'min',
  'max',
  'positive',
  'nonnegative',
  'negative',
  'nonpositive',
  'int',
] as const;
const bigIntValidations = [
  'refine',
  'min',
  'max',
  'positive',
  'nonnegative',
  'negative',
  'nonpositive',
] as const;
const stringValidations = [
  'refine',
  'minLength',
  'maxLength',
  'length',
  'url',
  'uuid',
  'email',
  'regex',
] as const;
const arrayValidations = ['refine', 'items', 'minLength', 'maxLength', 'length'] as const;

export class GiraphQLValidationPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  inputFieldValidators = new Map<string, Record<string, zod.ZodType<unknown>>>();

  onInputFieldConfig(
    fieldConfig: GiraphQLInputFieldConfig<Types>,
  ): GiraphQLInputFieldConfig<Types> {
    const fieldType = resolveInputTypeConfig(fieldConfig.type, this.buildCache);
    const validationOptions = fieldConfig.giraphqlOptions.validate as
      | ValidationOptionUnion
      | undefined;

    if (!validationOptions && fieldType.kind !== 'InputObject') {
      return fieldConfig;
    }

    const validator = this.createValidator(validationOptions, fieldConfig.type);

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

  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    // Only used to check if validation is required
    const argMap = mapInputFields(
      fieldConfig.args,
      this.buildCache,
      (field) => field.giraphqlOptions.validate || null,
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

    let validator: zod.ZodTypeAny = zod.object(args).nonstrict();

    if (fieldConfig.giraphqlOptions.validate) {
      validator = this.refine(validator, fieldConfig.giraphqlOptions.validate);
    }

    return (parent, args, context, info) => resolver(parent, validator.parse(args), context, info);
  }

  createValidator(
    options: ValidationOptionUnion | undefined,
    type: GiraphQLInputFieldType<Types>,
  ): zod.ZodTypeAny {
    if (typeof options === 'function') {
      return zod.unknown().refine(options);
    }

    const validators: zod.ZodTypeAny[] = [];

    if (!type.required) {
      validators.push(zod.null(), zod.undefined());
    }

    if (type.kind === 'InputObject') {
      const typeName = this.buildCache.getTypeConfig(type.ref).name;

      validators.push(
        this.refine(
          zod.lazy(() => zod.object(this.inputFieldValidators.get(typeName) || {}).nonstrict()),
          options as ObjectValidationOptions,
        ),
      );

      return this.combine(validators);
    }

    if (!options) {
      return zod.unknown();
    }

    if (isBaseValidator(options)) {
      validators.push(this.refine(zod.unknown(), options));

      return this.combine(validators);
    }

    if (isNumberValidator(options)) {
      let validator = zod.number();

      if (options.min) {
        validator = Array.isArray(options.min)
          ? validator.min(Number(options.min[0]), options.min[1])
          : validator.min(Number(options.min));
      }

      if (options.max) {
        validator = Array.isArray(options.max)
          ? validator.max(Number(options.max[0]), options.max[1])
          : validator.max(Number(options.max));
      }

      const booleanConstraints = [
        'int',
        'negative',
        'nonnegative',
        'positive',
        'nonpositive',
      ] as const;

      for (const constraint of booleanConstraints) {
        if (options[constraint]) {
          const value = options[constraint];
          validator = validator[constraint](Array.isArray(value) ? value[1] : {});
        }
      }

      validators.push(this.refine(validator, options));
    }

    if (isBigIntValidator(options)) {
      const validator = zod.bigint();

      validators.push(this.refine(validator, options));
    }

    if (isStringValidator(options)) {
      let validator = zod.string();

      if (options.length !== undefined) {
        validator = Array.isArray(options.length)
          ? validator.length(options.length[0], options.length[1])
          : validator.length(options.length);
      }

      if (options.minLength) {
        validator = Array.isArray(options.minLength)
          ? validator.min(options.minLength[0], options.minLength[1])
          : validator.min(options.minLength);
      }

      if (options.maxLength) {
        validator = Array.isArray(options.maxLength)
          ? validator.max(options.maxLength[0], options.maxLength[1])
          : validator.max(options.maxLength);
      }

      if (options.regex) {
        validator = Array.isArray(options.regex)
          ? validator.regex(options.regex[0], options.regex[1])
          : validator.regex(options.regex);
      }

      const booleanConstraints = ['email', 'url', 'uuid'] as const;

      for (const constraint of booleanConstraints) {
        if (options[constraint]) {
          const value = options[constraint];

          validator = validator[constraint](Array.isArray(value) ? value[1] : {});
        }
      }

      validators.push(this.refine(validator, options));
    }

    if (isArrayValidator(options)) {
      let validator = (options.items
        ? this.createValidator(options.items, type.kind === 'List' ? type.type : type)
        : zod.unknown()
      ).array();

      if (options.length !== undefined) {
        validator = Array.isArray(options.length)
          ? validator.length(options.length[0], options.length[1].message)
          : validator.length(options.length);
      }

      if (options.minLength) {
        validator = Array.isArray(options.minLength)
          ? validator.min(options.minLength[0], options.minLength[1])
          : validator.min(options.minLength);
      }

      if (options.maxLength) {
        validator = Array.isArray(options.maxLength)
          ? validator.max(options.maxLength[0], options.maxLength[1])
          : validator.max(options.maxLength);
      }

      validators.push(this.refine(validator, options));
    }

    return this.combine(validators);
  }

  refine<T>(
    validator: zod.ZodTypeAny,
    options: BaseValidationOptions<T> | ((val: T) => boolean) | undefined,
  ) {
    if (!options) {
      return validator;
    }

    if (typeof options === 'function') {
      return validator.refine(options);
    }

    if (!options.refine) {
      return validator;
    }

    if (typeof options.refine === 'function') {
      return validator.refine(options.refine);
    }

    if (typeof options.refine[0] === 'function') {
      return validator.refine(...(options.refine as [() => boolean, { message?: string }]));
    }

    const refinements = options.refine as [() => boolean, { message?: string }][];

    return refinements.reduce((prev, [refine, opts]) => validator.refine(refine, opts), validator);
  }

  combine(validators: zod.ZodTypeAny[]) {
    return validators.length > 1
      ? zod.union(validators as [zod.ZodTypeAny, zod.ZodTypeAny])
      : validators[0];
  }
}

SchemaBuilder.registerPlugin(pluginName, GiraphQLValidationPlugin);

export default pluginName;

function isBaseValidator(options: ValidationOptionUnion): options is BaseValidationOptions {
  const validations = Object.keys(options);

  return validations.every((validation) =>
    baseValidations.includes(validation as keyof BaseValidationOptions),
  );
}

function isNumberValidator(options: ValidationOptionUnion): options is NumberValidationOptions {
  const validations = Object.keys(options);

  return validations.every((validation) =>
    numberValidations.includes(validation as keyof NumberValidationOptions),
  );
}

function isBigIntValidator(options: ValidationOptionUnion): options is BigIntValidationOptions {
  const validations = Object.keys(options);

  return validations.every((validation) =>
    bigIntValidations.includes(validation as keyof BigIntValidationOptions),
  );
}

function isStringValidator(options: ValidationOptionUnion): options is StringValidationOptions {
  const validations = Object.keys(options);

  return validations.every((validation) =>
    stringValidations.includes(validation as keyof StringValidationOptions),
  );
}

function isArrayValidator(options: ValidationOptionUnion): options is ArrayValidationOptions {
  const validations = Object.keys(options);

  return validations.every((validation) =>
    arrayValidations.includes(validation as keyof ArrayValidationOptions),
  );
}
