import { TypeMap, TypeParam, FieldOptions, InputFields, CompatibleTypes } from '../types';
import Field from '../field';

export default class BaseFieldUtil<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Context
> {
  protected createField<
    Args extends InputFields<Types>,
    Type extends TypeParam<Types>,
    Req extends boolean,
    Extends extends string | null
  >(options: FieldOptions<Types, ParentType, Type, Req, Args, Context>, extendsField: Extends) {
    return new Field<Args, Types, ParentType, Type, Req, Context, Extends>({
      ...options,
      extendsField,
    });
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Req extends boolean,
    Name extends CompatibleTypes<Types, ParentType, Type, Req>,
    Extends extends string | null
  >(
    name: Name,
    options: Omit<FieldOptions<Types, ParentType, Type, Req, {}, Context>, 'resolver'>,
    extendsField: Extends,
  ) {
    return new Field<{}, Types, ParentType, Type, Req, Context, Extends>({
      ...options,
      resolver: parent => parent[name],
      extendsField,
    });
  }

  protected fieldTypeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Args extends InputFields<Types>, Req extends boolean>(
      options: Omit<FieldOptions<Types, ParentType, Type, Req, Args, Context>, 'type'>,
    ): Field<Args, Types, ParentType, Type, Req, Context, null> => {
      return this.createField<Args, Type, Req, null>({ ...options, type }, null);
    };
  }

  protected exposeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Req extends boolean, Name extends CompatibleTypes<Types, ParentType, Type, Req>>(
      name: Name,
      options: Omit<
        FieldOptions<Types, ParentType, Type, Req, {}, Context>,
        'resolver' | 'type'
      > = {},
    ): Field<{}, Types, ParentType, Type, Req, Context, null> => {
      return this.exposeField<Type, Req, Name, null>(name, { ...options, type }, null);
    };
  }
}
