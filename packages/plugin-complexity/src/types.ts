import { InputFieldMap, SchemaTypes } from '@giraphql/core';

export interface ComplexityPluginOptions<Types extends SchemaTypes> {
  limit: Partial<ComplexityResult> | ((ctx: Types['Context']) => Partial<ComplexityResult>);
  defaultComplexity?: number;
  defaultListMultiplier?: number;
}

export type FieldComplexity<Context, Args extends InputFieldMap> =
  | FieldComplexityValue
  | ((args: Args, ctx: Context) => FieldComplexityValue);

export type FieldComplexityValue =
  | number
  | {
      field?: number;
      multiplier?: number;
    };

export interface ComplexityResult {
  breadth: number;
  depth: number;
  complexity: number;
}
