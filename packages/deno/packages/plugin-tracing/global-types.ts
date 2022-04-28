// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import { FieldNullability, InputFieldMap, PothosOutputFieldConfig, SchemaTypes, TypeParam, } from '../core/index.ts';
import { TracingFieldWrapper } from './types.ts';
import { PothosTracingPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            tracing: PothosTracingPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            tracing?: {
                default: Types["Tracing"] | ((config: PothosOutputFieldConfig<Types>) => Types["Tracing"]);
                wrap: TracingFieldWrapper<Types>;
            };
        }
        export interface UserSchemaTypes {
            Tracing: unknown;
        }
        export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
            Tracing: unknown extends PartialTypes["Tracing"] ? boolean : PartialTypes["Tracing"];
        }
        export interface FieldOptions<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap, ResolveShape, ResolveReturnShape> {
            tracing?: Types["Tracing"];
        }
    }
}
