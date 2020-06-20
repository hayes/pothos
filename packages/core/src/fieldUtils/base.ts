import { TypeParam, CompatibleTypes, FieldNullability, SchemaTypes } from '../types';
import Field from '../field';
import { ShapeFromTypeParam, InputFieldMap, FieldKind } from '..';

export default class BaseFieldUtil<Types extends SchemaTypes, ParentShape, Kind extends FieldKind> {
  typename: string;

  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  kind: Kind;

  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, kind: Kind) {
    this.typename = name;
    this.builder = builder;
    this.kind = kind;
  }

  protected createField<
    Args extends InputFieldMap,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>
  >(
    options: GiraphQLSchemaTypes.FieldOptions<Types, ParentShape, Type, Nullable, Args, any, {}>,
  ): Field<ShapeFromTypeParam<Types, Type, Nullable>> {
    return new Field(options as GiraphQLSchemaTypes.FieldOptions, this.typename, this.kind);
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
      this.kind,
    );
  }
}
