import type { SchemaTypes } from '@pothos/core';
import type { PrismaNextObjectRef } from './object-ref';
import type { IsToMany, ModelName, RelatedModel, RelationKeys } from './types';

/** @internal */
export type ParamToModelName<Types extends SchemaTypes, Param> =
  Param extends ModelName<Types>
    ? Param
    : Param extends [infer M extends ModelName<Types>]
      ? M
      : Param extends PrismaNextObjectRef<Types, infer M extends ModelName<Types>, unknown>
        ? M
        : Param extends [PrismaNextObjectRef<Types, infer M extends ModelName<Types>, unknown>]
          ? M
          : never;

/** @internal */
export type ParamToTypeParam<Types extends SchemaTypes, Param, Shape> =
  Param extends PrismaNextObjectRef<Types, ModelName<Types>, unknown>
    ? Param
    : Param extends [PrismaNextObjectRef<Types, ModelName<Types>, unknown>]
      ? Param
      : Param extends [unknown]
        ? [PrismaNextObjectRef<Types, ParamToModelName<Types, Param>, Shape>]
        : PrismaNextObjectRef<Types, ParamToModelName<Types, Param>, Shape>;

export type RelationRef<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  RelatedShape,
> =
  IsToMany<Types, M, R> extends true
    ? [PrismaNextObjectRef<Types, RelatedModel<Types, M, R>, RelatedShape>]
    : PrismaNextObjectRef<Types, RelatedModel<Types, M, R>, RelatedShape>;

export type ValidateFieldSelect<ParentShape, Select> = Select extends readonly string[]
  ? {
      readonly [K in keyof Select]: Select[K] extends keyof ParentShape & string
        ? Select[K]
        : never;
    }
  : Select;

type Normalize<T> = { [K in keyof T]: T[K] } & {};

export type ShapeFromSelect<ParentShape, Select> = unknown extends Select
  ? ParentShape
  : Select extends readonly (infer K extends keyof ParentShape)[]
    ? Normalize<Pick<ParentShape, K>>
    : ParentShape;
