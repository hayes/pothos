export type Constraint<T> =
  | T
  | (T extends object
      ? [value: T, options: { message?: string; path?: string[] }]
      : [value: T, options: { message?: string }]);
export interface BaseValidationOptions<T = unknown> {
  refine?: Constraint<(value: T) => boolean> | Constraint<(value: T) => boolean>[];
}
export interface NumberValidationOptions<T extends number = number>
  extends BaseValidationOptions<T> {
  min?: Constraint<number>;
  max?: Constraint<number>;
  positive?: Constraint<boolean>;
  nonnegative?: Constraint<boolean>;
  negative?: Constraint<boolean>;
  nonpositive?: Constraint<boolean>;
  int?: Constraint<boolean>;
}

export type BigIntValidationOptions<T extends bigint = bigint> = BaseValidationOptions<T>;

export interface StringValidationOptions<T extends string = string>
  extends BaseValidationOptions<T> {
  minLength?: Constraint<number>;
  maxLength?: Constraint<number>;
  length?: Constraint<number>;
  url?: Constraint<boolean>;
  uuid?: Constraint<boolean>;
  email?: Constraint<boolean>;
  regex?: Constraint<RegExp>;
}

export type ObjectValidationOptions<T extends object = object> = BaseValidationOptions<T>;

export interface ArrayValidationOptions<T extends unknown[] = unknown[]>
  extends BaseValidationOptions<T> {
  items?: ValidationOptions<T[number]>;
  minLength?: Constraint<number>;
  maxLength?: Constraint<number>;
  length?: Constraint<number>;
}

export type ValidationOptions<T> =
  | ((value: T) => boolean)
  | (T extends number
      ? NumberValidationOptions<T>
      : T extends bigint
      ? BigIntValidationOptions<T>
      : T extends string
      ? StringValidationOptions<T>
      : T extends unknown[]
      ? ArrayValidationOptions<T>
      : T extends object
      ? ObjectValidationOptions<T>
      : BaseValidationOptions<T>);

export type ValidationOptionUnion =
  | ArrayValidationOptions
  | BigIntValidationOptions
  | NumberValidationOptions
  | ObjectValidationOptions
  | StringValidationOptions
  | ((value: unknown) => boolean);
