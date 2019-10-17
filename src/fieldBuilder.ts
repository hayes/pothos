import { TypeMap, TypeParam, FieldOptions, InputFields } from './types';
import Field from './field';

export default class FieldBuilder<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Name extends string,
  Context
> {
  name: Name;

  constructor(name: Name) {
    this.name = name;
  }

  boolean = this.fieldTypeHelper('Boolean');

  float = this.fieldTypeHelper('Float');

  id = this.fieldTypeHelper('ID');

  int = this.fieldTypeHelper('Int');

  string = this.fieldTypeHelper('String');

  booleanList = this.fieldTypeHelper(['Boolean']);

  floatList = this.fieldTypeHelper(['Float']);

  idList = this.fieldTypeHelper(['ID']);

  intList = this.fieldTypeHelper(['Int']);

  stringList = this.fieldTypeHelper(['String']);

  field<
    Args extends InputFields,
    Type extends TypeParam<Types>,
    Req extends boolean,
    Options extends FieldOptions<Types, ParentType, Type, Name, Req, Args, Context> = FieldOptions<
      Types,
      ParentType,
      Type,
      Name,
      Req,
      Args,
      Context
    >
  >(options: Options): Field<Name, Types, ParentType, Type, Req, Context, Args> {
    return new Field<Name, Types, ParentType, Type, Req, Context, Args>(this.name, options);
  }

  private fieldTypeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <
      Args extends InputFields,
      Req extends boolean,
      Options extends FieldOptions<Types, ParentType, Type, Name, Req, Args, Context>
    >(
      options: Omit<Options, 'type'>,
    ) => {
      return this.field<Args, Type, Req, Options>(
        // hack for now... for some reason omitting `type` field makes types unhappy
        // @ts-ignore
        { ...options, type },
      );
    };
  }
}
