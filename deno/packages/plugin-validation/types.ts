import { ZodSchema } from 'https://cdn.skypack.dev/zod@v1.11.17?dts';
export type Constraint<T> = T | (T extends object ? [
    value: T,
    options: {
        message?: string;
        path?: string[];
    }
] : [
    value: T,
    options: {
        message?: string;
    }
]);
export type RefineConstraint<T = unknown> = Constraint<(value: T) => boolean> | Constraint<(value: T) => boolean>[];
export interface BaseValidationOptions<T = unknown> {
    refine?: RefineConstraint<T>;
    schema?: ZodSchema<T>;
    type?: string;
}
export interface NumberValidationOptions<T extends number = number> extends BaseValidationOptions<T> {
    type?: "number";
    min?: Constraint<number>;
    max?: Constraint<number>;
    positive?: Constraint<boolean>;
    nonnegative?: Constraint<boolean>;
    negative?: Constraint<boolean>;
    nonpositive?: Constraint<boolean>;
    int?: Constraint<boolean>;
}
export interface BigIntValidationOptions<T extends bigint = bigint> extends BaseValidationOptions<T> {
    type?: "bigint";
}
export interface BooleanValidationOptions<T extends boolean = boolean> extends BaseValidationOptions<T> {
    type?: "boolean";
}
export interface DateValidationOptions<T extends Date = Date> extends BaseValidationOptions<T> {
    type?: "date";
}
export interface StringValidationOptions<T extends string = string> extends BaseValidationOptions<T> {
    type?: "string";
    minLength?: Constraint<number>;
    maxLength?: Constraint<number>;
    length?: Constraint<number>;
    url?: Constraint<boolean>;
    uuid?: Constraint<boolean>;
    email?: Constraint<boolean>;
    regex?: Constraint<RegExp>;
}
export interface ObjectValidationOptions<T extends object = object> extends BaseValidationOptions<T> {
    type?: "object";
}
export interface ArrayValidationOptions<T extends unknown[] = unknown[]> extends BaseValidationOptions<T> {
    type?: "array";
    items?: ValidationOptions<T[number]>;
    minLength?: Constraint<number>;
    maxLength?: Constraint<number>;
    length?: Constraint<number>;
}
export type ValidationOptions<T> = RefineConstraint<T> | (T extends number ? NumberValidationOptions<T> : T extends bigint ? BigIntValidationOptions<T> : T extends boolean ? BooleanValidationOptions<T> : T extends string ? StringValidationOptions<T> : T extends Date ? DateValidationOptions<T> : T extends unknown[] ? ArrayValidationOptions<T> : T extends object ? ObjectValidationOptions<T> : BaseValidationOptions<T>);
export type ValidationOptionUnion = ArrayValidationOptions | BaseValidationOptions | BigIntValidationOptions | BooleanValidationOptions | DateValidationOptions | NumberValidationOptions | ObjectValidationOptions | StringValidationOptions;
