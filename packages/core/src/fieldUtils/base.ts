/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { TypeParam, InputFields, CompatibleTypes, FieldNullability } from '../types';
import Field from '../graphql/field';

export default class BaseFieldUtil<Types extends GiraphQLSchemaTypes.TypeInfo, ParentShape> {
  typename: string;

  constructor(name: string) {
    this.typename = name;
  }

  protected createField<
    Args extends InputFields<Types>,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>
  >(
    options: GiraphQLSchemaTypes.FieldOptions<Types, ParentShape, Type, Nullable, Args, any>,
  ): Field<Args, Types, Type> {
    return new Field(
      {
        ...options,
      },
      this.typename,
    );
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>,
    Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, {}>,
      'resolve'
    >,
  ) {
    return new Field<{}, Types, Type>(
      {
        ...options,
        // @ts-ignore
        resolve: parent => parent[name],
      },
      this.typename,
    );
  }
}
