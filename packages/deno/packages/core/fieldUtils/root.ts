// @ts-nocheck
import { ListRef } from '../refs/list.ts';
import type { ArgBuilder, InputFieldMap, NormalizeArgs, ShapeFromTypeParam } from '../types/index.ts';
import { FieldKind, FieldNullability, FieldOptionsFromKind, SchemaTypes, TypeParam, } from '../types/index.ts';
import { BaseFieldUtil } from './base.ts';
import { InputFieldBuilder } from './input.ts';
export class RootFieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> extends BaseFieldUtil<Types, ParentShape, Kind> {
    arg: ArgBuilder<Types> = new InputFieldBuilder<Types, "Arg">(this.builder, "Arg").argBuilder();
    /**
     * Create a Boolean field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    boolean<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<"Boolean"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, "Boolean", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "Boolean", Nullable>({
            resolve: undefined as never,
            ...options,
            type: "Boolean",
        });
    }
    /**
     * Create a Float field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    float<Args extends InputFieldMap, Nullable extends FieldNullability<"Float">, ResolveShape, ResolveReturnShape>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, "Float", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "Float", Nullable>({
            resolve: undefined as never,
            ...options,
            type: "Float",
        });
    }
    /**
     * Create a ID field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    id<Args extends InputFieldMap, Nullable extends FieldNullability<"ID">, ResolveShape, ResolveReturnShape>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, "ID", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "ID", Nullable>({
            resolve: undefined as never,
            ...options,
            type: "ID",
        });
    }
    /**
     * Create a Int field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    int<Args extends InputFieldMap, Nullable extends FieldNullability<"Int">, ResolveShape, ResolveReturnShape>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, "Int", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "Int", Nullable>({
            resolve: undefined as never,
            ...options,
            type: "Int",
        });
    }
    /**
     * Create a String field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    string<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<"String"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, "String", Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, "String", Nullable>({
            resolve: undefined as never,
            ...options,
            type: "String",
        });
    }
    /**
     * Create a Boolean list field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    booleanList<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<[
        "Boolean"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Boolean"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "Boolean"
        ], Nullable>({
            resolve: undefined as never,
            ...options,
            type: ["Boolean"],
        });
    }
    /**
     * Create a Float list field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    floatList<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<[
        "Float"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Float"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "Float"
        ], Nullable>({
            resolve: undefined as never,
            ...options,
            type: ["Float"],
        });
    }
    /**
     * Create a ID list field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    idList<Args extends InputFieldMap, Nullable extends FieldNullability<[
        "ID"
    ]>, ResolveShape, ResolveReturnShape>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "ID"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "ID"
        ], Nullable>({
            resolve: undefined as never,
            ...options,
            type: ["ID"],
        });
    }
    /**
     * Create a Int list field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    intList<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<[
        "Int"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Int"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "Int"
        ], Nullable>({
            resolve: undefined as never,
            ...options,
            type: ["Int"],
        });
    }
    /**
     * Create a String list field
     * @param {PothosSchemaTypes.FieldOptions} options - Options for this field
     */
    stringList<Args extends InputFieldMap, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<[
        "String"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        options: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "String"
        ], Nullable, Args, Kind, ResolveShape, ResolveReturnShape>, "type">
    ]>) {
        const [options = {} as never] = args;
        return this.createField<Args, [
            "String"
        ], Nullable>({
            resolve: undefined as never,
            ...options,
            type: ["String"],
        });
    }
    /**
     * create a new field for the current type
     * @param {PothosSchemaTypes.FieldOptions} options - options for this field
     */
    field<Args extends InputFieldMap, Type extends TypeParam<Types>, ResolveShape, ResolveReturnShape, Nullable extends FieldNullability<Type> = Types["DefaultFieldNullability"]>(options: FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind, ResolveShape, ResolveReturnShape>) {
        return this.createField<Args, Type, Nullable>(options as never);
    }
    listRef<T extends TypeParam<Types>, Nullable extends boolean = false>(type: T, options?: {
        nullable?: Nullable;
    }): ListRef<Types, ShapeFromTypeParam<Types, T, Nullable>[]> {
        return new ListRef<Types, ShapeFromTypeParam<Types, T, Nullable>[]>(type, options?.nullable ?? false);
    }
}
