import { SchemaTypes } from '@pothos/core';

type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

type CompositeRules<Types extends SchemaTypes> = RequireAtLeastOne<{
  and?: Types['AuthZRule'][];
  or?: Types['AuthZRule'][];
  not?: Types['AuthZRule'];
}>[];

export type AuthZOption<Types extends SchemaTypes> =
  | {
      rules: Types['AuthZRule'][];
    }
  | {
      compositeRules: CompositeRules<Types>;
    };
