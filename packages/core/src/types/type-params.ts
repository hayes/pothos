import { SchemaTypes, ObjectRef, InterfaceRef, RootName } from '..';

export const outputShapeKey = Symbol.for('GiraphQL.outputShapeKey');
export const inputShapeKey = Symbol.for('GiraphQL.inputShapeKey');
export const inputFieldShapeKey = Symbol.for('GiraphQL.inputFieldShapeKey');
export const outputFieldShapeKey = Symbol.for('GiraphQL.outputFieldShapeKey');

export type OutputShape<T, Types extends SchemaTypes> = T extends {
  [outputShapeKey]: infer U;
}
  ? U
  : T extends { new (...args: unknown[]): infer U }
  ? U extends {
      [outputShapeKey]: infer V;
    }
    ? V
    : U
  : T extends keyof Types['outputShapes']
  ? Types['outputShapes'][T]
  : never;

export type InputShape<T, Types extends SchemaTypes> = T extends {
  [inputShapeKey]: infer U;
}
  ? U
  : T extends { new (...args: unknown[]): infer U }
  ? U extends {
      [inputShapeKey]: infer V;
    }
    ? V
    : U
  : T extends keyof Types['inputShapes']
  ? Types['inputShapes'][T]
  : never;

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

export interface PartialInput {
  kind: 'InputField' | 'FieldArgument';

  [inputFieldShapeKey]: unknown;
}

export type OutputType<Types extends SchemaTypes> =
  | keyof Types['outputShapes']
  | {
      [outputShapeKey]: unknown;
    }
  | {
      new (...args: unknown[]): unknown;
    };

export type InputType<Types extends SchemaTypes> =
  | keyof Types['inputShapes']
  | {
      [inputShapeKey]: unknown;
    };

export type ConfigurableRef<Types extends SchemaTypes> =
  | OutputType<Types>
  | InputType<Types>
  | RootName;

export type TypeParam<Types extends SchemaTypes> = OutputType<Types> | [OutputType<Types>];

export type InputTypeParam<Types extends SchemaTypes> = InputType<Types> | [InputType<Types>];

export type ObjectParam<Types extends SchemaTypes> =
  | Extract<OutputType<Types>, Types['objects']>
  | ObjectRef<unknown>
  | {
      new (...args: unknown[]): unknown;
    };

export type InterfaceParam<Types extends SchemaTypes> =
  | Extract<OutputType<Types>, Types['interfaces']>
  | InterfaceRef<unknown>
  | {
      new (...args: unknown[]): unknown;
    };

export type ShapeFromTypeParam<
  Types extends SchemaTypes,
  Param extends TypeParam<Types>,
  Nullable extends FieldNullability<Param>
> = Param extends [OutputType<Types>]
  ? ShapeFromListTypeParam<Types, Param, Nullable>
  : FieldNullability<Param> extends Nullable
  ? OutputShape<Param, Types>
  : Nullable extends true
  ? OutputShape<Param, Types> | undefined | null
  : OutputShape<Param, Types>;

export type ShapeFromListTypeParam<
  Types extends SchemaTypes,
  Param extends [OutputType<Types>],
  Nullable extends FieldNullability<Param>
> = Nullable extends true
  ? OutputShape<Param[0], Types>[] | undefined | null
  : Nullable extends false
  ? OutputShape<Param[0], Types>[]
  : Nullable extends { list: infer List; items: infer Items }
  ? Items extends boolean
    ? List extends true
      ? ShapeFromTypeParam<Types, Param[0], Items>[] | undefined | null
      : ShapeFromTypeParam<Types, Param[0], Items>[]
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
  : Required extends true
  ? InputShape<Param, Types>
  : InputShape<Param, Types> | undefined | null;

export type InputShapeFromListTypeParam<
  Types extends SchemaTypes,
  Param extends [InputType<Types>],
  Required extends FieldRequiredness<Param>
> = Required extends true
  ? InputShape<Param[0], Types>[]
  : Required extends false
  ? InputShape<Param[0], Types>[] | undefined | null
  : Required extends { list: infer List; items: infer Items }
  ? Items extends boolean
    ? List extends true
      ? InputShapeFromTypeParam<Types, Param[0], Items>[]
      : InputShapeFromTypeParam<Types, Param[0], Items>[] | undefined | null
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
