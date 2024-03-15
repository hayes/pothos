export type MaybePromise<T> = Promise<T> | T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type RequiredKeys<T extends object> = Exclude<keyof T, OptionalKeys<T>>;

export type OptionalKeys<T extends object> = {
  [K in keyof T]: T[K] | undefined extends T[K] ? K : T[K] | null extends T[K] ? K : never;
}[keyof T];

export type NonEmptyKeys<T extends object> = undefined extends {}
  ? // non-strict mode, all keys are optional
    never
  : {
      [K in keyof T]: {} extends T[K] ? never : T[K] extends NonNullable<T[K]> ? K : never;
    }[keyof T];

export type EmptyKeys<T extends object> = {
  [K in keyof T]: {} extends T[K] ? K : T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

export type Normalize<T> = T extends object ? { [K in keyof T]: T[K] } : T;

export type NullableToOptional<T> = T extends object
  ? Normalize<{ [K in OptionalKeys<T>]?: T[K] } & { [K in RequiredKeys<T>]: T[K] }>
  : T;

export type EmptyToOptional<T> = T extends object
  ? Normalize<{ [K in EmptyKeys<T> | OptionalKeys<T>]?: T[K] } & { [K in NonEmptyKeys<T>]: T[K] }>
  : T;

export type NormalizeNullable<T> = undefined extends T
  ? T | null | undefined
  : null extends T
    ? T | null | undefined
    : T;

export type NormalizeNullableFields<T extends object> = {
  [K in OptionalKeys<T>]?: T[K] | null | undefined;
} & {
  [K in RequiredKeys<T>]: T[K];
};

// Check if T is a Record of string keys who's values are not functions
export type IsSimpleRecord<T> = (
  [T] extends [Record<string, any>] // eslint-disable-line @typescript-eslint/no-explicit-any
    ? keyof T extends infer K
      ? K extends string
        ? T[K] extends (...args: any[]) => unknown
          ? // check if T[K] is any (T[K] is distributed, so it can't also be a number unless its any)
            [1] extends [T[K]]
            ? never
            : false
          : never
        : never
      : false
    : false
) extends never
  ? true
  : false;

export type RecursivelyNormalizeNullableFields<T> = T extends null | undefined
  ? null | undefined
  : T extends (infer L)[]
    ? RecursivelyNormalizeNullableFields<L>[]
    : T extends (...args: any[]) => unknown
      ? T
      : keyof T extends string
        ? IsSimpleRecord<T> extends true
          ? Normalize<
              {
                [K in OptionalKeys<T & object>]?: K extends string
                  ? RecursivelyNormalizeNullableFields<NonNullable<T[K]>> | null | undefined
                  : T[K];
              } & {
                [K in RequiredKeys<T & object>]: RecursivelyNormalizeNullableFields<
                  NonNullable<T[K]>
                >;
              }
            >
          : T
        : T;

export type RemoveNeverKeys<T extends {}> = {
  [K in keyof T as [T[K]] extends [never] ? never : K]: T[K];
};

export type Merge<T> = { [K in keyof T]: T[K] };

export interface Path {
  prev: Path | undefined;
  key: number | string;
  typename: string | undefined;
}

export type LastIndex<T extends unknown[]> = T extends [unknown, ...infer U] ? U['length'] : 0;

export type NormalizeArgs<
  T extends unknown[],
  Index extends keyof T = LastIndex<T>,
> = undefined extends T[Index]
  ? {} extends T[Index]
    ? undefined extends {}
      ? // fix for strictMode: false
        { [K in keyof T]?: T[K] }
      : T
    : { [K in keyof T]-?: T[K] }
  : {} extends T[Index]
    ? { [K in keyof T]?: T[K] }
    : T;

export type IsStrictMode = undefined extends {} ? false : true;
