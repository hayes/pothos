// @ts-nocheck
import type { FieldNullability, InputFieldMap, InputShapeFromFields, SchemaTypes, TypeParam, } from '../core/index.ts';
import type { ComplexityPluginOptions, FieldComplexity } from './types.ts';
import type { PothosComplexityPlugin } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            complexity: PothosComplexityPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            complexity?: ComplexityPluginOptions<Types>;
        }
        export interface BuildSchemaOptions<Types extends SchemaTypes> {
            complexity?: ComplexityPluginOptions<Types>;
        }
        export interface FieldOptions<Types extends SchemaTypes = SchemaTypes, ParentShape = unknown, Type extends TypeParam<Types> = TypeParam<Types>, Nullable extends FieldNullability<Type> = FieldNullability<Type>, Args extends InputFieldMap = InputFieldMap, ResolveShape = unknown, ResolveReturnShape = unknown> {
            complexity?: FieldComplexity<Types["Context"], InputShapeFromFields<Args>>;
        }
    }
}
