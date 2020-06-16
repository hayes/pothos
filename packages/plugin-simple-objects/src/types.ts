import { SchemaTypes, Field, FieldMap, NullableToOptional } from '@giraphql/core';

export type SimpleObjectFieldsShape<Types extends SchemaTypes, Fields extends FieldMap> = (
  t: GiraphQLSchemaTypes.RootFieldBuilder<Types, unknown, 'SimpleObject'>,
) => Fields;

export type SimpleInterfaceFieldsShape<Types extends SchemaTypes, Fields extends FieldMap> = (
  t: GiraphQLSchemaTypes.RootFieldBuilder<Types, unknown, 'SimpleInterface'>,
) => Fields;

export type OutputShapeFromFields<Fields extends FieldMap> = NullableToOptional<
  {
    [K in keyof Fields]: Fields[K] extends Field<infer T> ? T : never;
  }
>;
