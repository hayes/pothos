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
  ParentType extends TypeParam<Types>,
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
    options: FieldOptionsFromKind<Types, ParentType, Type, Nullable, Args, Kind>,
    extendsField: Extends,
  ): Field<
    Args,
    Types,
    ParentType,
    Type,
    Nullable,
    Extends,
    Kind,
    FieldOptionsFromKind<Types, ParentType, Type, Nullable, Args, Kind>
  > {
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
    Name extends CompatibleTypes<Types, ParentType, Type, Nullable>,
    Extends extends string | null
  >(
    name: Name,
    options: Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentType, Type, Nullable, {}>,
      'resolve'
    >,
    extendsField: Extends,
  ) {
    return new Field<{}, Types, ParentType, Type, Nullable, Extends>(
      {
        ...options,
        // @ts-ignore
        resolve: parent => parent[name],
        extendsField,
      },
      this.typename,
    );
  }

  protected fieldTypeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Args extends InputFields<Types>, Nullable extends boolean>(
      options: Omit<FieldOptionsFromKind<Types, ParentType, Type, Nullable, Args, Kind>, 'type'>,
    ): Field<
      Args,
      Types,
      ParentType,
      Type,
      Nullable,
      null,
      Kind,
      FieldOptionsFromKind<Types, ParentType, Type, Nullable, Args, Kind>
    > => {
      const mergedOptions = {
        ...options,
        type,
      } as FieldOptionsFromKind<Types, ParentType, Type, Nullable, Args, Kind>;

      return this.createField(mergedOptions, null);
    };
  }

  protected exposeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      Name extends CompatibleTypes<Types, ParentType, Type, Nullable>
    >(
      name: Name,
      options: Omit<
        GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentType, Type, Nullable, {}>,
        'resolve' | 'type'
      > = {},
    ): Field<{}, Types, ParentType, Type, Nullable, null> => {
      return this.exposeField<Type, Nullable, Name, null>(name, { ...options, type }, null);
    };
  }
}
