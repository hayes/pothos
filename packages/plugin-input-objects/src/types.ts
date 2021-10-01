import {
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InputFieldRef,
  InputShapeFromFields,
  RootFieldBuilder,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';

type SchemaBuilder<Types extends SchemaTypes> = GiraphQLSchemaTypes.SchemaBuilder<Types>;

type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

export type WithInputBuilders<
  Types extends SchemaTypes,
  Args extends InputFieldMap,
  InputName extends string,
> = {
  [K in KeysMatching<
    Omit<SchemaBuilder<Types>, 'withInput2'>,
    (name: string, builder: (t: RootFieldBuilder<Types, {}>) => FieldRef) => void
  >]: <ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>>(
    name: string,
    options: GiraphQLSchemaTypes.FieldOptions<
      Types,
      ParentShape,
      Type,
      Nullable,
      {
        [Name in InputName]: InputFieldRef<InputShapeFromFields<Args>>;
      }
    >,
  ) => void;
};

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
