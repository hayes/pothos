import * as zod from 'zod';
import {
  ArrayValidationOptions,
  BaseValidationOptions,
  NumberValidationOptions,
  RefineConstraint,
  StringValidationOptions,
  ValidationOptionUnion,
} from './types';

const baseValidations = ['refine', 'schema'] as const;
const numberValidations = [
  ...baseValidations,
  'int',
  'max',
  'min',
  'negative',
  'nonnegative',
  'nonpositive',
  'positive',
  'type',
] as const;
const bigIntValidations = [...baseValidations, 'type'] as const;

const booleanValidations = [...baseValidations, 'type'] as const;

const dateValidations = [...baseValidations, 'type'] as const;

const stringValidations = [
  ...baseValidations,
  'email',
  'length',
  'maxLength',
  'minLength',
  'regex',
  'type',
  'url',
  'uuid',
] as const;
const arrayValidations = [
  ...baseValidations,
  'items',
  'length',
  'maxLength',
  'minLength',
  'type',
] as const;

const objectValidations = [...baseValidations, 'type'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validatorCreator<T extends BaseValidationOptions<any>>(
  type: NonNullable<T['type']>,
  validationNames: readonly (keyof T)[],
  create: (options: T) => zod.ZodTypeAny,
) {
  function check(options: ValidationOptionUnion): options is T {
    if (typeof options !== 'object' || (options.type && options.type !== type)) {
      return false;
    }

    const validations = Object.keys(options);

    return validations.every((validation) => validationNames.includes(validation as keyof T));
  }

  return (options: ValidationOptionUnion) => {
    if (check(options)) {
      return create(options);
    }

    return null;
  };
}

export function refine(
  originalValidator: zod.ZodTypeAny,
  options: ValidationOptionUnion | null | undefined,
) {
  if (!options) {
    return originalValidator;
  }

  if (typeof options === 'function') {
    return originalValidator.refine(options);
  }

  const validator = options.schema
    ? zod.intersection(options.schema, originalValidator)
    : originalValidator;

  if (!options.refine) {
    return validator;
  }

  if (typeof options.refine === 'function') {
    return validator.refine(options.refine);
  }

  if (typeof options.refine?.[0] === 'function') {
    return validator.refine(...(options.refine as [() => boolean, { message?: string }]));
  }

  const refinements = options.refine as [() => boolean, { message?: string }][];

  return refinements.reduce(
    (prev, [refineFn, opts]) => validator.refine(refineFn, opts),
    validator,
  );
}

export const createNumberValidator = validatorCreator(
  'number',
  numberValidations,
  (options: NumberValidationOptions) => {
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

    return refine(validator, options);
  },
);

export const createBigintValidator = validatorCreator('bigint', bigIntValidations, (options) =>
  refine(zod.bigint(), options),
);

export const createBooleanValidator = validatorCreator('boolean', booleanValidations, (options) =>
  refine(zod.boolean(), options),
);

export const createDateValidator = validatorCreator('date', dateValidations, (options) =>
  refine(zod.date(), options),
);

export const createStringValidator = validatorCreator(
  'string',
  stringValidations,
  (options: StringValidationOptions) => {
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
  },
);

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

export const createObjectValidator = validatorCreator('object', objectValidations, (options) =>
  refine(zod.object({}).nonstrict(), options),
);

const validationCreators = [
  createNumberValidator,
  createBigintValidator,
  createBooleanValidator,
  createDateValidator,
  createStringValidator,
  createObjectValidator,
];

export function isBaseValidator(options: ValidationOptionUnion) {
  if (typeof options === 'function') {
    return true;
  }

  const validations = Object.keys(options);

  return validations.every((validation) =>
    baseValidations.includes(validation as Exclude<keyof BaseValidationOptions, 'type'>),
  );
}

export function combine(validators: zod.ZodTypeAny[], intersect?: zod.ZodTypeAny | null) {
  const union =
    validators.length > 1
      ? zod.union(validators as [zod.ZodTypeAny, zod.ZodTypeAny])
      : validators[0];

  return intersect ? zod.intersection(intersect, union) : union;
}

export default function createZodSchema(
  optionsOrConstraint: RefineConstraint | ValidationOptionUnion | null | undefined,
  validators: zod.ZodTypeAny[] = [],
): zod.ZodTypeAny {
  const options: ValidationOptionUnion | null | undefined =
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

  const typeValidators = validationCreators
    .map((create) => create(options))
    .filter(Boolean) as zod.ZodTypeAny[];

  if (isArrayValidator(options)) {
    const items = options.items ? createZodSchema(options.items) : zod.unknown();
    typeValidators.push(createArrayValidator(options, items));
  }

  if (typeValidators.length === 0) {
    throw new Error(
      `No type validator can implement every constraint in (${Object.keys(options)})`,
    );
  }

  return combine([...validators, ...typeValidators]);
}
