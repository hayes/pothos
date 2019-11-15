/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  TypeParam,
  InputFields,
  CompatibleTypes,
  FieldNullability,
  MaybeSubscriptionFieldOptions,
} from '../types';
import Field from '../graphql/field';

export default class BaseFieldUtil<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  Subscription extends boolean = false
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
    options: MaybeSubscriptionFieldOptions<Types, ParentType, Type, Nullable, Args, Subscription>,
    extendsField: Extends,
  ): Field<
    Args,
    Types,
    ParentType,
    Type,
    Nullable,
    Extends,
    Subscription,
    MaybeSubscriptionFieldOptions<Types, ParentType, Type, Nullable, Args, Subscription>
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
      GiraphQLSchemaTypes.FieldOptions<Types, ParentType, Type, Nullable, {}>,
      'resolve'
    >,
    extendsField: Extends,
  ) {
    return new Field<{}, Types, ParentType, Type, Nullable, Extends>(
      {
        ...options,
        // @ts-ignore
        resolver: parent => parent[name],
        extendsField,
      },
      this.typename,
    );
  }

  protected fieldTypeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Args extends InputFields<Types>, Nullable extends boolean>(
      options: Omit<
        MaybeSubscriptionFieldOptions<Types, ParentType, Type, Nullable, Args, Subscription>,
        'type'
      >,
    ): Field<
      Args,
      Types,
      ParentType,
      Type,
      Nullable,
      null,
      Subscription,
      MaybeSubscriptionFieldOptions<Types, ParentType, Type, Nullable, Args, Subscription>
    > => {
      const mergedOptions = {
        ...options,
        type,
      } as MaybeSubscriptionFieldOptions<Types, ParentType, Type, Nullable, Args, Subscription>;

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
        GiraphQLSchemaTypes.FieldOptions<Types, ParentType, Type, Nullable, {}>,
        'resolve' | 'type'
      > = {},
    ): Field<{}, Types, ParentType, Type, Nullable, null> => {
      return this.exposeField<Type, Nullable, Name, null>(name, { ...options, type }, null);
    };
  }
}
