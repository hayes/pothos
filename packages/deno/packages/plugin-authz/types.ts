// @ts-nocheck
import { SchemaTypes } from '../core/index.ts';
type RequireAtLeastOne<T> = {
    [K in keyof T]-?: Partial<Pick<T, Exclude<keyof T, K>>> & Required<Pick<T, K>>;
}[keyof T];
type CompositeRules<Types extends SchemaTypes> = RequireAtLeastOne<{
    and?: Types["AuthZRule"][];
    or?: Types["AuthZRule"][];
    not?: Types["AuthZRule"];
}>[];
export type AuthZOption<Types extends SchemaTypes> = {
    compositeRules: CompositeRules<Types>;
} | {
    rules: Types["AuthZRule"][];
};
