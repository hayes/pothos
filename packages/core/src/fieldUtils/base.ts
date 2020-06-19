import { TypeParam, CompatibleTypes, FieldNullability, SchemaTypes } from '../types';
import Field from '../field';
import { ShapeFromTypeParam, InputFieldMap } from '..';

export default class BaseFieldUtil<Types extends SchemaTypes, ParentShape> {
  typename: string;

  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    this.typename = name;
    this.builder = builder;
  }

  protected createField<
    Args extends InputFieldMap,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>
  >(
    options: GiraphQLSchemaTypes.FieldOptions<Types, ParentShape, Type, Nullable, Args, any, {}>,
  ): Field<ShapeFromTypeParam<Types, Type, Nullable>> {
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
  ): Field<ShapeFromTypeParam<Types, Type, Nullable>> {
    return new Field(
      {
        ...(options as GiraphQLSchemaTypes.FieldOptions),

        resolve: (parent) => (parent as { [s: string]: Readonly<unknown> })[name as string],
      },
      this.typename,
    );
  }
}
