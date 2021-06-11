// @ts-nocheck
/* eslint-disable prettier/prettier */
export type MaybePromise<T> = Promise<T> | T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type RequiredKeys<T extends object> = {
    [K in keyof T]: T[K] extends NonNullable<T[K]> ? K : never;
}[keyof T];
export type OptionalKeys<T extends object> = {
    [K in keyof T]: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];
export type Normalize<T> = T extends object ? {
    [K in keyof T]: T[K];
} : T;
export type NullableToOptional<T> = T extends object ? Normalize<{
    [K in OptionalKeys<T>]?: T[K];
} & {
    [K in RequiredKeys<T>]: T[K];
}> : T;
export type NormalizeNullable<T> = undefined extends T ? T | null | undefined : null extends T ? T | null | undefined : T;
export type NormalizeNullableFields<T extends object> = {
    [K in RequiredKeys<T>]: T[K];
} & {
    [K in OptionalKeys<T>]?: T[K] | null | undefined;
};
export type RecursivelyNormalizeNullableFields<T> = T extends object[] ? ({
    [K in RequiredKeys<T[number]>]: RecursivelyNormalizeNullableFields<T[number][K]>;
} & {
    [K in OptionalKeys<T[number]>]?: RecursivelyNormalizeNullableFields<T[number][K]> | null | undefined;
})[] : T extends unknown[] ? NormalizeNullable<T[number]>[] : T extends object ? {
    [K in RequiredKeys<T>]: RecursivelyNormalizeNullableFields<T[K]>;
} & {
    [K in OptionalKeys<T>]?: RecursivelyNormalizeNullableFields<T[K]> | null | undefined;
} : NormalizeNullable<T>;
export type RemoveNeverKeys<T extends {}> = {
    [K in keyof T as [
        T[K]
    ] extends [
        never
    ] ? never : K]: T[K];
};
export type Merge<T> = {
    [K in keyof T]: T[K];
};
export interface Path {
    prev: Path | undefined;
    key: number | string;
    typename: string | undefined;
}
export type LastIndex<T extends unknown[]> = T extends [
    unknown,
    ...infer U
] ? U["length"] : 0;
export type NormalizeArgs<T extends unknown[]> = undefined extends T[LastIndex<T>] ? {} extends T[LastIndex<T>] ? T : {
    [K in keyof T]-?: NonNullable<T[K]>;
} : T;
