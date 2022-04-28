// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { PothosOutputFieldConfig, SchemaTypes } from '../core/index.ts';
export type TracingFieldWrapper<Types extends SchemaTypes> = (fieldConfig: PothosOutputFieldConfig<Types>, value: Types["Tracing"]) => null | ((next: () => unknown, parent: unknown, args: Record<string, unknown>, context: Types["Context"], info: GraphQLResolveInfo) => unknown);
