import type { FieldKind, FieldNullability, FieldRequiredness, InputFieldMap, InputFieldsFromShape, InputType, SchemaTypes, TypeParam } from '@pothos/core';
import type { ValidationPluginOptions } from './types.js';
import type { PothosZodPlugin } from './index.js';
import type { StandardSchemaV1 } from './standard-schema.js';
declare global {
    export namespace PothosSchemaTypes {
        interface Plugins<Types extends SchemaTypes> {
            validation: PothosZodPlugin<Types>;
        }
        interface SchemaBuilderOptions<Types extends SchemaTypes> {
            validation?: ValidationPluginOptions<Types>;
        }
        interface FieldOptions<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap, ResolveShape, ResolveReturnShape> {
            validate?: StandardSchemaV1;
        }
        interface InputObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Fields extends InputFieldMap = InputFieldMap> {
            validate?: StandardSchemaV1;
        }
        interface InputFieldOptions<Types extends SchemaTypes = SchemaTypes, Type extends InputType<Types> | [
            InputType<Types>
        ] = InputType<Types> | [
            InputType<Types>
        ], Req extends FieldRequiredness<Type> = FieldRequiredness<Type>> {
            validate?: StandardSchemaV1;
        }
        interface InputObjectRef<Types extends SchemaTypes, T> {
            validate<R>(schema: StandardSchemaV1<unknown, R>): InputObjectRef<Types, R>;
        }
        interface FieldRef<Types extends SchemaTypes, T = unknown, Kind extends FieldKind = FieldKind> {
            validate<R>(schema: StandardSchemaV1<unknown, R>): FieldRef<Types, R, Kind>;
        }
        interface InputFieldRef<Types extends SchemaTypes, T> {
            validate<R>(schema: StandardSchemaV1<unknown, R>): InputFieldRef<Types, R>;
        }
        interface ArgumentRef<Types extends SchemaTypes, T> {
            validate<R>(schema: StandardSchemaV1<unknown, R>): ArgumentRef<Types, R>;
        }
        interface RootFieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> {
            validate<Args extends InputFieldMap, R>(args: Args, schema: StandardSchemaV1<unknown, R>): InputFieldsFromShape<Types, R, "Arg">;
        }
    }
}
//# sourceMappingURL=global-types.d.ts.map
