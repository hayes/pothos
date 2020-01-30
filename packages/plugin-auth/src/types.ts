import { InputFields, InputShapeFromFields } from '@giraphql/core/src';

export type MaybePromise<T> = T | Promise<T>;

export type AuthCheck<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape> = (
  parent: ParentShape,
  context: Types['Context'],
) => MaybePromise<boolean>;

export type AuthGrantMap = { [s: string]: boolean };

export type PreResolveAuthCheck<Types extends GiraphQLSchemaTypes.TypeInfo> = (
  context: Types['Context'],
) => MaybePromise<boolean | AuthGrantMap>;

export type AuthCheckMap<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape> = {
  [s: string]: AuthCheck<Types, ParentShape>;
};

export type AuthCheckWithGrants<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Args extends InputFields<Types>
> = (
  parent: ParentShape,
  args: InputShapeFromFields<Types, Args>,
  context: Types['Context'],
) => MaybePromise<boolean | AuthGrantMap>;

export type CheckAuth<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Args extends InputFields<Types>
> =
  | string
  | AuthCheckWithGrants<Types, ParentShape, Args>
  | (string | AuthCheckWithGrants<Types, ParentShape, Args>[]);
