// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { PothosOutputFieldConfig, SchemaTypes } from '../core/index.ts';
export type TracingFieldWrapper<Types extends SchemaTypes> = (fieldConfig: PothosOutputFieldConfig<Types>, value: Exclude<Types["Tracing"], false | null>) => null | ((next: () => unknown, options: Exclude<Types["Tracing"], false | null>, parent: unknown, args: Record<string, unknown>, context: Types["Context"], info: GraphQLResolveInfo) => unknown);
export type TracingFieldOptions<Types extends SchemaTypes, ParentShape, Args extends object> = Types["Tracing"] | ((parent: ParentShape, Args: Args, context: Types["Context"], info: GraphQLResolveInfo) => Types["Tracing"]);
