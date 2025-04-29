// @ts-nocheck
import type { SchemaTypes } from '../core/index.ts';
import type { GraphQLField, GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
export enum ComplexityErrorKind {
    Complexity = "Complexity",
    Depth = "Depth",
    Breadth = "Breadth"
}
export interface ComplexityPluginOptions<Types extends SchemaTypes> {
    limit?: Partial<ComplexityResult> | ((ctx: Types["Context"]) => Partial<ComplexityResult>);
    fieldComplexity?: FieldComplexityFunction<Types["Context"], Record<string, unknown>>;
    defaultComplexity?: number;
    defaultListMultiplier?: number;
    complexityError?: ComplexityErrorFn;
    disabled?: boolean;
}
export type ComplexityErrorFn = (kind: ComplexityErrorKind, result: ComplexityResult & {
    [K in keyof ComplexityResult as `max${Capitalize<K>}`]?: number;
}, info: GraphQLResolveInfo) => Error | string;
export type FieldComplexity<Context, Args> = FieldComplexityFunction<Context, Args> | FieldComplexityValue;
export type FieldComplexityFunction<Context, Args> = (args: Args, ctx: Context, field: GraphQLField<unknown, Context, Args>) => FieldComplexityValue;
export type FieldComplexityValue = number | {
    field?: number;
    multiplier?: number;
};
export interface ComplexityResult {
    breadth: number;
    depth: number;
    complexity: number;
}
