import {
  TypeMap,
  TypeParam,
  FieldOptions,
  InputFields,
  CompatibleTypes,
  NamedTypeParam,
} from '../types';
import Field from '../field';

export default class BaseFieldUtil<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Context
> {
  typename: NamedTypeParam<Types>;

  constructor(name: NamedTypeParam<Types>) {
    this.typename = name;
  }

  protected createField<
    Args extends InputFields<Types>,
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    Extends extends string | null
  >(
    options: FieldOptions<Types, ParentType, Type, Nullable, Args, Context>,
    extendsField: Extends,
  ) {
    return new Field<Args, Types, ParentType, Type, Nullable, Context, Extends>(
      {
        ...options,
        extendsField,
      },
      this.typename,
    );
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    Name extends CompatibleTypes<Types, ParentType, Type, Nullable>,
    Extends extends string | null
  >(
    name: Name,
    options: Omit<FieldOptions<Types, ParentType, Type, Nullable, {}, Context>, 'resolve'>,
    extendsField: Extends,
  ) {
    return new Field<{}, Types, ParentType, Type, Nullable, Context, Extends>(
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
      options: Omit<FieldOptions<Types, ParentType, Type, Nullable, Args, Context>, 'type'>,
    ): Field<Args, Types, ParentType, Type, Nullable, Context, null> => {
      return this.createField<Args, Type, Nullable, null>({ ...options, type }, null);
    };
  }

  protected exposeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      Name extends CompatibleTypes<Types, ParentType, Type, Nullable>
    >(
      name: Name,
      options: Omit<
        FieldOptions<Types, ParentType, Type, Nullable, {}, Context>,
        'resolve' | 'type'
      > = {},
    ): Field<{}, Types, ParentType, Type, Nullable, Context, null> => {
      return this.exposeField<Type, Nullable, Name, null>(name, { ...options, type }, null);
    };
  }
}
