// @ts-nocheck
import { CompatibleTypes, FieldKind, FieldNullability, FieldOptionsFromKind, NormalizeArgs, RootName, SchemaTypes, TypeParam, } from '../types/index.ts';
import RootFieldBuilder from './root.ts';
export default class FieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends Exclude<FieldKind, RootName> = Exclude<FieldKind, RootName>> extends RootFieldBuilder<Types, ParentShape, Kind> {
    exposeBoolean<Name extends CompatibleTypes<Types, ParentShape, "Boolean", Nullable>, ResolveReturnShape, Nullable extends FieldNullability<"Boolean"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "Boolean", Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<"Boolean", Nullable, Name>(name, { ...options, type: "Boolean" });
    }
    exposeFloat<Name extends CompatibleTypes<Types, ParentShape, "Float", Nullable>, ResolveReturnShape, Nullable extends FieldNullability<"Float"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "Float", Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<"Float", Nullable, Name>(name, { ...options, type: "Float" });
    }
    exposeID<Name extends CompatibleTypes<Types, ParentShape, "ID", Nullable>, ResolveReturnShape, Nullable extends FieldNullability<"ID"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "ID", Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<"ID", Nullable, Name>(name, { ...options, type: "ID" });
    }
    exposeInt<Name extends CompatibleTypes<Types, ParentShape, "Int", Nullable>, ResolveReturnShape, Nullable extends FieldNullability<"Int"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "Int", Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "args" | "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<"Int", Nullable, Name>(name, { ...options, type: "Int" });
    }
    exposeString<Name extends CompatibleTypes<Types, ParentShape, "String", Nullable>, ResolveReturnShape, Nullable extends FieldNullability<"String"> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, "String", Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<"String", Nullable, Name>(name, { ...options, type: "String" });
    }
    exposeBooleanList<Name extends CompatibleTypes<Types, ParentShape, [
        "Boolean"
    ], Nullable>, ResolveReturnShape, Nullable extends FieldNullability<[
        "Boolean"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Boolean"
        ], Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<[
            "Boolean"
        ], Nullable, Name>(name, { ...options, type: ["Boolean"] });
    }
    exposeFloatList<Name extends CompatibleTypes<Types, ParentShape, [
        "Float"
    ], Nullable>, ResolveReturnShape, Nullable extends FieldNullability<[
        "Float"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Float"
        ], Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<[
            "Float"
        ], Nullable, Name>(name, { ...options, type: ["Float"] });
    }
    exposeIDList<Name extends CompatibleTypes<Types, ParentShape, [
        "ID"
    ], Nullable>, ResolveReturnShape, Nullable extends FieldNullability<[
        "ID"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "ID"
        ], Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<[
            "ID"
        ], Nullable, Name>(name, { ...options, type: ["ID"] });
    }
    exposeIntList<Name extends CompatibleTypes<Types, ParentShape, [
        "Int"
    ], Nullable>, ResolveReturnShape, Nullable extends FieldNullability<[
        "Int"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "Int"
        ], Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<[
            "Int"
        ], Nullable, Name>(name, { ...options, type: ["Int"] });
    }
    exposeStringList<Name extends CompatibleTypes<Types, ParentShape, [
        "String"
    ], Nullable>, ResolveReturnShape, Nullable extends FieldNullability<[
        "String"
    ]> = Types["DefaultFieldNullability"]>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, [
            "String"
        ], Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField<[
            "String"
        ], Nullable, Name>(name, { ...options, type: ["String"] });
    }
    expose<Type extends TypeParam<Types>, Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>>(...args: NormalizeArgs<[
        name: Name,
        options?: Omit<FieldOptionsFromKind<Types, ParentShape, Type, Nullable, {}, Kind, ParentShape, ResolveReturnShape>, "resolve">
    ]>) {
        const [name, options = {} as never] = args;
        return this.exposeField(name, options);
    }
}
