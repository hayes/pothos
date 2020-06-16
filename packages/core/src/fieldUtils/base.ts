import { TypeParam, InputFields, CompatibleTypes, FieldNullability, SchemaTypes } from '../types';
import Field from '../field';

export default class BaseFieldUtil<Types extends SchemaTypes, ParentShape> {
  typename: string;

  constructor(name: string) {
    this.typename = name;
  }

  protected createField<
    Args extends InputFields,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>
  >(
    options: GiraphQLSchemaTypes.FieldOptions<Types, ParentShape, Type, Nullable, Args, any, {}>,
  ): Field {
    return new Field(options as GiraphQLSchemaTypes.FieldOptions, this.typename);
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>,
    Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, {}, {}>,
      'resolve'
    >,
  ) {
    return new Field(
      {
        ...(options as GiraphQLSchemaTypes.FieldOptions),

        resolve: (parent) => (parent as { [s: string]: Readonly<unknown> })[name as string],
      },
      this.typename,
    );
  }
}
