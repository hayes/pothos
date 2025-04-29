// @ts-nocheck
import type { FieldNullability, InputFieldMap, InputShapeFromFields, PothosOutputFieldConfig, SchemaTypes, TypeParam, } from '../core/index.ts';
import type { TracingFieldOptions, TracingFieldWrapper } from './types.ts';
import type { PothosTracingPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            tracing: PothosTracingPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            tracing?: {
                default: Types["Tracing"] | ((config: PothosOutputFieldConfig<Types>) => TracingFieldOptions<Types, unknown, Record<string, unknown>>);
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
            tracing?: TracingFieldOptions<Types, ParentShape, InputShapeFromFields<Args>>;
        }
    }
}
