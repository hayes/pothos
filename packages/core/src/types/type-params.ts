import { SchemaTypes, ObjectRef, InterfaceRef, RootName } from '..';

export const outputShapeKey = Symbol.for('GiraphQL.outputShapeKey');
export const inputShapeKey = Symbol.for('GiraphQL.inputShapeKey');
export const inputFieldShapeKey = Symbol.for('GiraphQL.inputFieldShapeKey');
export const outputFieldShapeKey = Symbol.for('GiraphQL.outputFieldShapeKey');

export type OutputShape<Types extends SchemaTypes, T> = T extends {
  [outputShapeKey]: infer U;
}
  ? U
  : T extends { new (...args: any[]): infer U }
  ? U extends {
      [outputShapeKey]: infer V;
    }
    ? V
    : U
  : T extends keyof Types['outputShapes']
  ? Types['outputShapes'][T]
  : T extends BaseEnum
  ? ValuesFromEnum<T>
  : never;

export type InputShape<Types extends SchemaTypes, T> = T extends {
  [inputShapeKey]: infer U;
}
  ? U
  : T extends { new (...args: any[]): infer U }
  ? U extends {
      [inputShapeKey]: infer V;
    }
    ? V
    : U
  : T extends keyof Types['inputShapes']
  ? Types['inputShapes'][T]
  : T extends BaseEnum
  ? ValuesFromEnum<T>
  : never;

export interface OutputRefShape<T> {
  [outputShapeKey]: T;
}

export interface InputRefShape<T> {
  [inputShapeKey]: T;
}

export interface OutputRef {
  [outputShapeKey]: unknown;
  name: string;
  kind: 'Object' | 'Interface' | 'Scalar' | 'Enum' | 'Union';
}

export interface InputRef {
  [inputShapeKey]: unknown;
  name: string;
  kind: 'InputObject' | 'Scalar' | 'Enum';
}

export type OutputType<Types extends SchemaTypes> =
  | keyof Types['outputShapes']
  | {
      [outputShapeKey]: unknown;
    }
  | {
      new (...args: any[]): any;
    }
  | BaseEnum;

export type InputType<Types extends SchemaTypes> =
  | keyof Types['inputShapes']
  | {
      [inputShapeKey]: unknown;
    }
  | BaseEnum;

export type ConfigurableRef<Types extends SchemaTypes> =
  | OutputType<Types>
  | InputType<Types>
  | RootName;

export type TypeParam<Types extends SchemaTypes> = OutputType<Types> | [OutputType<Types>];

export type InputTypeParam<Types extends SchemaTypes> = InputType<Types> | [InputType<Types>];

export type ObjectParam<Types extends SchemaTypes> =
  | Extract<OutputType<Types>, keyof Types['Objects']>
  | ObjectRef<unknown>
  | {
      new (...args: any[]): any;
    };

export type InterfaceParam<Types extends SchemaTypes> =
  | Extract<OutputType<Types>, keyof Types['Interfaces']>
  | InterfaceRef<unknown>
  | {
      new (...args: any[]): unknown;
    };

export interface BaseEnum {
  [s: string]: string | number;
  [s: number]: string;
}

export type ValuesFromEnum<T extends BaseEnum> = T[keyof T];

export type EnumParam = string | BaseEnum;

export type ShapeFromTypeParam<
  Types extends SchemaTypes,
  Param extends TypeParam<Types>,
  Nullable extends FieldNullability<Param>
> = Param extends [OutputType<Types>]
  ? ShapeFromListTypeParam<Types, Param, Nullable>
  : FieldNullability<Param> extends Nullable
  ? Types['DefaultFieldNullability'] extends true
    ? OutputShape<Types, Param> | null | undefined
    : OutputShape<Types, Param>
  : Nullable extends true
  ? OutputShape<Types, Param> | undefined | null
  : OutputShape<Types, Param>;

export type ShapeFromListTypeParam<
  Types extends SchemaTypes,
  Param extends [OutputType<Types>],
  Nullable extends FieldNullability<Param>
> = FieldNullability<Param> extends Nullable
  ? Types['DefaultFieldNullability'] extends true
    ? OutputShape<Types, Param[0]>[] | null | undefined
    : OutputShape<Types, Param[0]>[]
  : Nullable extends true
  ? OutputShape<Types, Param[0]>[] | undefined | null
  : Nullable extends false
  ? OutputShape<Types, Param[0]>[]
  : Nullable extends { list: infer List; items: infer Items }
  ? Items extends boolean
    ? List extends true
      ? ShapeFromTypeParam<Types, Param[0], Items extends false ? false : true>[] | undefined | null
      : ShapeFromTypeParam<Types, Param[0], Items extends false ? false : true>[]
    : never
  : never;

export type FieldNullability<Param> =
  | boolean
  | (Param extends [unknown]
      ?
          | boolean
          | {
              items: boolean;
              list: boolean;
            }
      : boolean);

export type InputShapeFromTypeParam<
  Types extends SchemaTypes,
  Param extends InputTypeParam<Types>,
  Required extends FieldRequiredness<Param>
> = Param extends [InputType<Types>]
  ? InputShapeFromListTypeParam<Types, Param, Required>
  : FieldRequiredness<Param> extends Required
  ? Types['DefaultInputFieldRequiredness'] extends false
    ? InputShape<Types, Param> | null | undefined
    : InputShape<Types, Param>
  : Required extends true
  ? InputShape<Types, Param>
  : InputShape<Types, Param> | undefined | null;

export type InputShapeFromListTypeParam<
  Types extends SchemaTypes,
  Param extends [InputType<Types>],
  Required extends FieldRequiredness<Param>
> = FieldRequiredness<Param> extends Required
  ? Types['DefaultInputFieldRequiredness'] extends false
    ? InputShape<Types, Param[0]>[] | null | undefined
    : InputShape<Types, Param[0]>[]
  : Required extends true
  ? InputShape<Types, Param[0]>[]
  : Required extends false
  ? InputShape<Types, Param[0]>[] | undefined | null
  : FieldRequiredness<Param> extends Required
  ? InputShape<Types, Param[0]>[] | undefined | null
  : Required extends { list: infer List; items: infer Items } | boolean
  ? Items extends boolean
    ? List extends true
      ? InputShapeFromTypeParam<Types, Param[0], Items extends false ? false : true>[]
      :
          | InputShapeFromTypeParam<Types, Param[0], Items extends false ? false : true>[]
          | undefined
          | null
    : never
  : never;

export type FieldRequiredness<Param> =
  | boolean
  | (Param extends [unknown]
      ?
          | boolean
          | {
              items: boolean;
              list: boolean;
            }
      : boolean);
