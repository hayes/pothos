export type MaybePromise<T> = T | Promise<T>;

export type MaybePromiseWithInference<T, U> = U extends Promise<unknown> ? Promise<T> : T;

export type MyabePromiseOrArray<Type, Return> = Return &
  MaybePromiseWithInference<
    Type extends unknown[]
      ? Readonly<
          | Type
          | (Return extends MaybePromise<Promise<unknown>[]> ? MaybePromise<Type[number]>[] : never)
        >
      : Type,
    Return
  >;

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type RequiredKeys<T extends object> = {
  [K in keyof T]: undefined extends T[K] ? never : null extends T[K] ? never : K;
}[keyof T];

export type NullableToOptional<T extends object> = Partial<T> &
  {
    [K in RequiredKeys<T>]: T[K];
  };

export type OptionalKeys<T> = {
  [K in keyof T]: undefined extends T[K] ? K : null extends T[K] ? K : never;
}[keyof T];

export type NormalizeNullable<T> = undefined extends T
  ? T | null | undefined
  : null extends T
  ? T | null | undefined
  : T;

export type NormalizeNullableFields<T extends object> = {
  [K in RequiredKeys<T>]: T[K];
} &
  {
    [K in OptionalKeys<T>]?: T[K] | null | undefined;
  };

export type RecursivelyNormalizeNullableFields<T> = T extends object[]
  ? ({
      [K in RequiredKeys<T[number]>]: RecursivelyNormalizeNullableFields<T[number][K]>;
    } &
      {
        [K in OptionalKeys<T[number]>]?:
          | RecursivelyNormalizeNullableFields<T[number][K]>
          | null
          | undefined;
      })[]
  : T extends unknown[]
  ? NormalizeNullable<T[number]>[]
  : T extends object
  ? {
      [K in RequiredKeys<T>]: RecursivelyNormalizeNullableFields<T[K]>;
    } &
      {
        [K in OptionalKeys<T>]?: RecursivelyNormalizeNullableFields<T[K]> | null | undefined;
      }
  : NormalizeNullable<T>;
