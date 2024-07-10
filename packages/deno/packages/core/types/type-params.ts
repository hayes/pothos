// @ts-nocheck
import type { ArgumentRef } from '../refs/arg.ts';
import { BaseTypeRef } from '../refs/base.ts';
import type { InputFieldRef } from '../refs/input-field.ts';
import type { InterfaceRef } from '../refs/interface.ts';
import type { ObjectRef } from '../refs/object.ts';
import type { RootName, SchemaTypes } from './schema-types.ts';
export const outputShapeKey = Symbol.for("Pothos.outputShapeKey");
export const parentShapeKey = Symbol.for("Pothos.parentShapeKey");
export const abstractReturnShapeKey = Symbol.for("Pothos.abstractReturnShapeKey");
export const inputShapeKey = Symbol.for("Pothos.inputShapeKey");
export const inputFieldShapeKey = Symbol.for("Pothos.inputFieldShapeKey");
export const outputFieldShapeKey = Symbol.for("Pothos.outputFieldShapeKey");
export const typeBrandKey = Symbol.for("Pothos.typeBrandKey");
export type OutputShape<Types extends SchemaTypes, T> = T extends {
    [outputShapeKey]: infer U;
} ? U : T extends new (...args: any[]) => infer U ? U extends {
    [outputShapeKey]: infer V;
} ? V : U : T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends BaseEnum ? ValuesFromEnum<T> : never;
export type ParentShape<Types extends SchemaTypes, T> = T extends {
    [parentShapeKey]: infer U;
} ? U : OutputShape<Types, T>;
export type AbstractReturnShape<Types extends SchemaTypes, T, ResolveType = unknown> = unknown extends ResolveType ? T extends {
    [abstractReturnShapeKey]: infer U;
} ? U : OutputShape<Types, T> : OutputShape<Types, T>;
export type InputShape<Types extends SchemaTypes, T> = T extends {
    [inputShapeKey]: infer U;
} ? U : T extends new (...args: any[]) => infer U ? U extends {
    [inputShapeKey]: infer V;
} ? V : U : T extends keyof Types["inputShapes"] ? Types["inputShapes"][T] : T extends BaseEnum ? ValuesFromEnum<T> : never;
export interface OutputRefShape<T> {
    [outputShapeKey]: T;
}
export interface InputRefShape<T> {
    [inputShapeKey]: T;
}
export interface OutputRef<T = unknown> {
    [outputShapeKey]: T;
    name: string;
    kind: "Enum" | "Interface" | "Object" | "Scalar" | "Union";
}
export interface InputRef<T = unknown> {
    [inputShapeKey]: T;
    name: string;
    kind: "Enum" | "InputList" | "InputObject" | "Scalar";
}
export type OutputType<Types extends SchemaTypes> = BaseEnum | keyof Types["outputShapes"]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
 | (new (...args: any[]) => any) | {
    [outputShapeKey]: unknown;
};
export type InputType<Types extends SchemaTypes> = BaseEnum | keyof Types["inputShapes"] | {
    [inputShapeKey]: unknown;
};
export type ConfigurableRef<Types extends SchemaTypes> = BaseTypeRef<Types, unknown> | InputType<Types> | OutputType<Types> | RootName;
export type TypeParam<Types extends SchemaTypes> = OutputType<Types> | [
    OutputType<Types>
];
export type InputTypeParam<Types extends SchemaTypes> = InputType<Types> | [
    InputType<Types>
];
export type ObjectParam<Types extends SchemaTypes> = Extract<OutputType<Types>, keyof Types["Objects"]> | ObjectRef<Types, unknown> // eslint-disable-next-line @typescript-eslint/no-explicit-any
 | (new (...args: any[]) => any);
export type InterfaceParam<Types extends SchemaTypes> = Extract<OutputType<Types>, keyof Types["Interfaces"]> | InterfaceRef<Types, unknown> | (new (...args: any[]) => unknown);
export interface BaseEnum {
    [s: string]: number | string;
    [s: number]: string;
}
export type ValuesFromEnum<T extends BaseEnum> = T[keyof T];
export type EnumParam = BaseEnum | string;
export type ShapeWithNullability<Types extends SchemaTypes, Shape, Nullable extends boolean> = boolean extends Nullable ? Types["DefaultFieldNullability"] extends true ? Shape | null | undefined : Shape : Nullable extends true ? Shape | null | undefined : Shape;
export type ShapeFromTypeParam<Types extends SchemaTypes, Param extends TypeParam<Types>, Nullable extends FieldNullability<Param>> = Param extends [
    OutputType<Types>
] ? ShapeFromListTypeParam<Types, Param, Nullable> : FieldNullability<Param> extends Nullable ? Types["DefaultFieldNullability"] extends true ? OutputShape<Types, Param> | null | undefined : OutputShape<Types, Param> : Nullable extends true ? OutputShape<Types, Param> | null | undefined : OutputShape<Types, Param>;
export type ShapeFromListTypeParam<Types extends SchemaTypes, Param extends [
    OutputType<Types>
], Nullable extends FieldNullability<Param>> = FieldNullability<Param> extends Nullable ? Types["DefaultFieldNullability"] extends true ? readonly OutputShape<Types, Param[0]>[] | null | undefined : readonly OutputShape<Types, Param[0]>[] : Nullable extends true ? readonly OutputShape<Types, Param[0]>[] | null | undefined : Nullable extends false ? readonly OutputShape<Types, Param[0]>[] : Nullable extends {
    list: infer List;
    items: infer Items;
} ? Items extends boolean ? List extends true ? readonly ShapeFromTypeParam<Types, Param[0], Items extends false ? false : true>[] | null | undefined : readonly ShapeFromTypeParam<Types, Param[0], Items extends false ? false : true>[] : never : never;
export type FieldNullability<Param> = boolean | (Param extends [
    unknown
] ? boolean | {
    items: boolean;
    list: boolean;
} : boolean);
export type InputShapeFromTypeParam<Types extends SchemaTypes, Param extends InputTypeParam<Types>, Required extends FieldRequiredness<Param>> = Param extends [
    InputType<Types>
] ? InputShapeFromListTypeParam<Types, Param, Required> : FieldRequiredness<Param> extends Required ? Types["DefaultInputFieldRequiredness"] extends false ? InputShape<Types, Param> | null | undefined : InputShape<Types, Param> : Required extends true ? InputShape<Types, Param> : InputShape<Types, Param> | null | undefined;
export type InputShapeFromListTypeParam<Types extends SchemaTypes, Param extends [
    InputType<Types>
], Required extends FieldRequiredness<Param>> = FieldRequiredness<Param> extends Required ? Types["DefaultInputFieldRequiredness"] extends false ? InputShape<Types, Param[0]>[] | null | undefined : InputShape<Types, Param[0]>[] : Required extends true ? InputShape<Types, Param[0]>[] : Required extends false ? InputShape<Types, Param[0]>[] | null | undefined : FieldRequiredness<Param> extends Required ? InputShape<Types, Param[0]>[] | null | undefined : Required extends boolean | {
    list: infer List;
    items: infer Items;
} ? Items extends boolean ? List extends true ? InputShapeFromTypeParam<Types, Param[0], Items extends false ? false : true>[] : InputShapeFromTypeParam<Types, Param[0], Items extends false ? false : true>[] | null | undefined : never : never;
export type FieldRequiredness<Param> = boolean | (Param extends [
    unknown
] ? boolean | {
    items: boolean;
    list: boolean;
} : boolean);
export type InputOrArgRef<Types extends SchemaTypes, T, Kind extends "Arg" | "InputObject"> = Kind extends "Arg" ? ArgumentRef<Types, T> : Kind extends "InputObject" ? InputFieldRef<Types, T> : never;
export interface GenericFieldRef<T = unknown> {
    [outputFieldShapeKey]: T;
}
export interface GenericInputFieldRef<T = unknown> {
    [inputFieldShapeKey]: T;
}
