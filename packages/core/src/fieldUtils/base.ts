/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  TypeParam,
  InputFields,
  CompatibleTypes,
  FieldNullability,
  FieldOptionsFromKind,
} from '../types';
import Field from '../graphql/field';

export default class BaseFieldUtil<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Kind extends 'Object' | 'Interface' | 'Root' | 'Subscription'
> {
  typename: string;

  constructor(name: string) {
    this.typename = name;
  }

  protected createField<
    Args extends InputFields<Types>,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Types, Type>,
    Extends extends string | null
  >(
    options: FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind>,
    extendsField: Extends,
  ): Field<Args, Types, ParentShape, Type, Nullable, Kind> {
    return new Field(
      {
        ...options,
        extendsField,
      },
      this.typename,
    );
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Types, Type>,
    Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, {}>,
      'resolve'
    >,
  ) {
    return new Field<{}, Types, ParentShape, Type, Nullable>(
      {
        ...options,
        // @ts-ignore
        resolve: parent => parent[name],
      },
      this.typename,
    );
  }

  protected fieldTypeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Args extends InputFields<Types>, Nullable extends boolean>(
      options: Omit<FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind>, 'type'>,
    ): Field<Args, Types, ParentShape, Type, Nullable, Kind> => {
      const mergedOptions = {
        ...options,
        type,
      } as FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind>;

      return this.createField(mergedOptions, null);
    };
  }

  protected exposeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      Name extends CompatibleTypes<Types, ParentShape, Type, Nullable>
    >(
      name: Name,
      options: Omit<
        GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, {}>,
        'resolve' | 'type'
      > = {},
    ): Field<{}, Types, ParentShape, Type, Nullable> => {
      return this.exposeField<Type, Nullable, Name>(name, { ...options, type });
    };
  }
}
