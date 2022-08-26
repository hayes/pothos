// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { InputFieldMap, SchemaTypes } from '../core/index.ts';
export enum ComplexityErrorKind {
    Complexity = "Complexity",
    Depth = "Depth",
    Breadth = "Breadth"
}
export interface ComplexityPluginOptions<Types extends SchemaTypes> {
    limit: Partial<ComplexityResult> | ((ctx: Types["Context"]) => Partial<ComplexityResult>);
    defaultComplexity?: number;
    defaultListMultiplier?: number;
    complexityError?: ComplexityErrorFn;
    disabled?: boolean;
}
export type ComplexityErrorFn = (kind: ComplexityErrorKind, result: ComplexityResult & {
    [K in keyof ComplexityResult as `max${Capitalize<K>}`]?: number;
}, info: GraphQLResolveInfo) => Error | string;
export type FieldComplexity<Context, Args extends InputFieldMap> = FieldComplexityValue | ((args: Args, ctx: Context) => FieldComplexityValue);
export type FieldComplexityValue = number | {
    field?: number;
    multiplier?: number;
};
export interface ComplexityResult {
    breadth: number;
    depth: number;
    complexity: number;
}
