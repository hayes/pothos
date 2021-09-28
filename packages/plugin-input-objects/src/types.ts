import {
  FieldNullability,
  InputFieldMap,
  InputFieldRef,
  InputShapeFromFields,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';

export type WithInputOptions<
  Types extends SchemaTypes,
  Fields extends InputFieldMap,
  InputName extends string,
> = GiraphQLSchemaTypes.InputObjectTypeOptions<Types, Fields> & {
  name?: string;
  argName?: InputName;
};

export type QueryFieldWithInputOptions<
  Types extends SchemaTypes,
  Fields extends InputFieldMap,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  InputName extends string,
  ResolveReturnShape,
> = Omit<
  GiraphQLSchemaTypes.QueryFieldOptions<
    Types,
    Type,
    Nullable,
    {
      [K in InputName]: InputFieldRef<InputShapeFromFields<Fields>>;
    },
    ResolveReturnShape
  >,
  'args'
>;
