import * as zod from 'zod';
import {
  ArrayValidationOptions,
  BaseValidationOptions,
  BigIntValidationOptions,
  BooleanValidationOptions,
  NumberValidationOptions,
  RefineConstraint,
  StringValidationOptions,
  ValidationOptionUnion,
} from './types';

const baseValidations = ['refine'] as const;
const numberValidations = [
  'type',
  'refine',
  'min',
  'max',
  'positive',
  'nonnegative',
  'negative',
  'nonpositive',
  'int',
] as const;
const bigIntValidations = ['type', 'refine'] as const;

const booleanValidations = ['type', 'refine'] as const;

const stringValidations = [
  'type',
  'refine',
  'minLength',
  'maxLength',
  'length',
  'url',
  'uuid',
  'email',
  'regex',
] as const;
const arrayValidations = ['type', 'refine', 'items', 'minLength', 'maxLength', 'length'] as const;

export default function createZodSchema(
  optionsOrConstraint: RefineConstraint | ValidationOptionUnion | null | undefined,
  validators: zod.ZodTypeAny[] = [],
): zod.ZodTypeAny {
  const options =
    Array.isArray(optionsOrConstraint) || typeof optionsOrConstraint === 'function'
      ? { refine: optionsOrConstraint }
      : optionsOrConstraint;

  if (!options) {
    return zod.unknown();
  }

  if (isBaseValidator(options)) {
    validators.push(refine(zod.unknown(), options));

    return combine(validators);
  }

  if (isNumberValidator(options)) {
    validators.push(createNumberValidator(options));
  }

  if (isBigIntValidator(options)) {
    const validator = zod.bigint();

    validators.push(refine(validator, options));
  }

  if (isBooleanValidator(options)) {
    const validator = zod.boolean();

    validators.push(refine(validator, options));
  }

  if (isStringValidator(options)) {
    validators.push(createStringValidator(options));
  }

  if (isArrayValidator(options)) {
    const items = options.items ? createZodSchema(options.items) : zod.unknown();

    validators.push(createArrayValidator(options, items));
  }

  if (isObjectValidator(options)) {
    const validator = zod.object({}).nonstrict();

    validators.push(refine(validator, options));
  }

  return combine(validators);
}

export function isBaseValidator(options: ValidationOptionUnion): options is BaseValidationOptions {
  if (typeof options === 'function') {
    return true;
  }

  const validations = Object.keys(options);

  return validations.every((validation) =>
    baseValidations.includes(validation as keyof BaseValidationOptions),
  );
}

export function isNumberValidator(
  options: ValidationOptionUnion,
): options is NumberValidationOptions {
  if (typeof options !== 'object' || (options.type && options.type !== 'number')) {
    return false;
  }

  const validations = Object.keys(options);

  return validations.every((validation) =>
    numberValidations.includes(validation as keyof NumberValidationOptions),
  );
}

export function isBigIntValidator(
  options: ValidationOptionUnion,
): options is BigIntValidationOptions {
  if (typeof options !== 'object' || (options.type && options.type !== 'bigint')) {
    return false;
  }

  const validations = Object.keys(options);

  return validations.every((validation) =>
    bigIntValidations.includes(validation as keyof BigIntValidationOptions),
  );
}

export function isBooleanValidator(
  options: ValidationOptionUnion,
): options is BooleanValidationOptions {
  if (typeof options !== 'object' || (options.type && options.type !== 'boolean')) {
    return false;
  }

  const validations = Object.keys(options);

  return validations.every((validation) =>
    booleanValidations.includes(validation as keyof BigIntValidationOptions),
  );
}

export function isStringValidator(
  options: ValidationOptionUnion,
): options is StringValidationOptions {
  if (typeof options !== 'object' || (options.type && options.type !== 'string')) {
    return false;
  }
  const validations = Object.keys(options);

  return validations.every((validation) =>
    stringValidations.includes(validation as keyof StringValidationOptions),
  );
}

export function isArrayValidator(
  options: ValidationOptionUnion,
): options is ArrayValidationOptions {
  if (typeof options !== 'object' || (options.type && options.type !== 'array')) {
    return false;
  }
  const validations = Object.keys(options);

  return validations.every((validation) =>
    arrayValidations.includes(validation as keyof ArrayValidationOptions),
  );
}

export function isObjectValidator(
  options: ValidationOptionUnion,
): options is ArrayValidationOptions {
  return typeof options === 'object' && options.type === 'object';
}

export function createNumberValidator(options: NumberValidationOptions) {
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

  const booleanConstraints = ['int', 'negative', 'nonnegative', 'positive', 'nonpositive'] as const;

  for (const constraint of booleanConstraints) {
    if (options[constraint]) {
      const value = options[constraint];
      validator = validator[constraint](Array.isArray(value) ? value[1] : {});
    }
  }

  return refine(validator, options);
}

export function createStringValidator(options: StringValidationOptions) {
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

  return refine(validator, options);
}

export function refine(validator: zod.ZodTypeAny, options: ValidationOptionUnion | undefined) {
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

export function createArrayValidator(
  options: ArrayValidationOptions<unknown[]>,
  items: zod.ZodTypeAny,
) {
  let validator = items.array();

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

  return refine(validator, options);
}

export function combine(validators: zod.ZodTypeAny[]) {
  return validators.length > 1
    ? zod.union(validators as [zod.ZodTypeAny, zod.ZodTypeAny])
    : validators[0];
}
