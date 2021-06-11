// @ts-nocheck
import { FieldKind, FieldNullability, FieldOptionsFromKind, SchemaTypes, TypeParam, } from '../types/index.ts';
import BaseFieldUtil from './base.ts';
import InputFieldBuilder from './input.ts';
import { ArgBuilder, InputFieldMap, NormalizeArgs } from '../index.ts';
export default class RootFieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> extends BaseFieldUtil<Types, ParentShape, Kind> {
    arg: ArgBuilder<Types> = new InputFieldBuilder<Types, "Arg">(this.builder, "Arg", this.typename).argBuilder();
    boolean<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<"Boolean"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "Boolean", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "Boolean", Nullable>({
            ...options,
            type: "Boolean",
        });
    }
    float<Args extends InputFieldMap, Nullable extends FieldNullability<"Float">, ResolveShape, ResolveReturnShape>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "Float", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "Float", Nullable>({
            ...options,
            type: "Float",
        });
    }
    id<Args extends InputFieldMap, Nullable extends FieldNullability<"ID">, ResolveShape, ResolveReturnShape>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "ID", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "ID", Nullable>({ ...options, type: "ID" });
    }
    int<Args extends InputFieldMap, Nullable extends FieldNullability<"Int">, ResolveShape, ResolveReturnShape>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "Int", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "Int", Nullable>({ ...options, type: "Int" });
    }
    string<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<"String"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "String", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "String", Nullable>({
            ...options,
            type: "String",
        });
    }
    booleanList<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<[
        "Boolean"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Boolean"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "Boolean"
        ], Nullable>({ ...options, type: ["Boolean"] });
    }
    floatList<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<[
        "Float"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Float"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "Float"
        ], Nullable>({ ...options, type: ["Float"] });
    }
    idList<Args extends InputFieldMap, Nullable extends FieldNullability<[
        "ID"
    ]>, ResolveShape, ResolveReturnShape>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "ID"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "ID"
        ], Nullable>({ ...options, type: ["ID"] });
    }
    intList<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<[
        "Int"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Int"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "Int"
        ], Nullable>({ ...options, type: ["Int"] });
    }
    stringList<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<[
        "String"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "String"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "String"
        ], Nullable>({ ...options, type: ["String"] });
    }
    /** create a new field for the current type
     @param {GiraphQLSchemaTypes.FieldOptions} options - options for this field
    */
    field<Args extends InputFieldMap, Type extends TypeParam<Types>, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<Type> = Types["DefaultFieldNullability"]>(options: FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind, ResolveShape, ResolveReturnShape>) {
        return this.createField<Args, Type, Nullable>(options);
    }
}
