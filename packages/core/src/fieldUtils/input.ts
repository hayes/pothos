/* eslint-disable unicorn/consistent-function-scoping, no-dupe-class-members, lines-between-class-members */
import { InputType } from '../types';

export default class InputFieldBuilder<Types extends GiraphQLSchemaTypes.TypeInfo> {
  bool = this.helper('Boolean');

  float = this.helper('Float');

  id = this.helper('ID');

  int = this.helper('Int');

  string = this.helper('String');

  boolList = this.helper(['Boolean']);

  floatList = this.helper(['Float']);

  idList = this.helper(['ID']);

  intList = this.helper(['Int']);

  stringList = this.helper(['String']);

  type<Type extends InputType<Types> | [InputType<Types>]>(
    type: Type,
  ): { type: Type; required: false; description?: string };
  type<Type extends InputType<Types> | [InputType<Types>], Req extends boolean = false>(
    type: Type,
    options: GiraphQLSchemaTypes.InputOptions<Req> | undefined,
  ): { type: Type; required: Req; description?: string };
  type<Type extends InputType<Types> | [InputType<Types>], Req extends boolean>(
    type: Type,
    options?: GiraphQLSchemaTypes.InputOptions<Req> | undefined,
  ) {
    return {
      description: options && options.description,
      required: options ? options.required : false,
      type,
    };
  }

  list<Type extends InputType<Types>>(
    type: Type,
  ): { type: [Type]; required: false; description?: string };
  list<Type extends InputType<Types>, Req extends boolean = false>(
    type: Type,
    options: GiraphQLSchemaTypes.InputOptions<Req> | undefined,
  ): { type: [Type]; required: Req; description?: string };
  list<Type extends InputType<Types>, Req extends boolean>(
    type: Type,
    options?: GiraphQLSchemaTypes.InputOptions<Req> | undefined,
  ) {
    return {
      description: options && options.description,
      required: options ? options.required : false,
      type: [type] as [Type],
    };
  }

  callableBuilder() {
    const builder = <
      Type extends InputType<Types> | [InputType<Types>],
      Req extends boolean = false
    >(
      type: Type,
      options?: GiraphQLSchemaTypes.InputOptions<Req>,
    ): { type: Type } & GiraphQLSchemaTypes.InputOptions<Req> => this.type(type, options);

    (Object.keys(this) as (keyof InputFieldBuilder<Types>)[]).forEach(key => {
      ((builder as unknown) as { [s: string]: unknown })[key] = this[key];
    });

    return builder as InputFieldBuilder<Types> & typeof builder;
  }

  private helper<Type extends InputType<Types> | [InputType<Types>]>(type: Type) {
    function createType(): { type: Type; required: false; description?: string };
    function createType<Req extends boolean = false>(
      options: GiraphQLSchemaTypes.InputOptions<Req> | undefined,
    ): { type: Type; required: Req; description?: string };
    function createType<Req extends boolean>(
      options?: GiraphQLSchemaTypes.InputOptions<Req> | undefined,
    ) {
      return {
        description: options && options.description,
        required: options ? options.required : false,
        type,
      };
    }

    return createType;
  }
}
