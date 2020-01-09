/* eslint-disable unicorn/consistent-function-scoping, no-dupe-class-members, lines-between-class-members */
import { InputType, InputShapeFromField } from '../types';

export default class InputFieldBuilder<Types extends GiraphQLSchemaTypes.TypeInfo> {
  bool = this.helper('Boolean');

  boolean = this.helper('Boolean');

  float = this.helper('Float');

  id = this.helper('ID');

  int = this.helper('Int');

  string = this.helper('String');

  boolList = this.helper(['Boolean']);

  booleanList = this.helper(['Boolean']);

  floatList = this.helper(['Float']);

  idList = this.helper(['ID']);

  intList = this.helper(['Int']);

  stringList = this.helper(['String']);

  callableBuilder() {
    const builder: InputFieldBuilder<Types>['type'] = this.type.bind(this);

    ([...Object.keys(this), 'type', 'list'] as (keyof InputFieldBuilder<Types>)[]).forEach(key => {
      ((builder as unknown) as { [s: string]: unknown })[key] = this[key];
    });

    return builder as InputFieldBuilder<Types> & typeof builder;
  }

  type<Type extends InputType<Types> | [InputType<Types>]>(
    type: Type,
  ): { type: Type; required: false; description?: string };
  type<Type extends InputType<Types>, Req extends boolean>(
    type: Type,
    options: GiraphQLSchemaTypes.InputOptions<Types, Type, Req> | undefined,
  ): {
    type: Type;
    required: Req;
    description?: string;
    default?: NonNullable<InputShapeFromField<Types, Type>>;
  };
  type<Type extends [InputType<Types>], Req extends boolean | { list: boolean; items: boolean }>(
    type: Type,
    options: GiraphQLSchemaTypes.InputOptions<Types, Type, Req> | undefined,
  ): {
    type: Type;
    required: Req;
    description?: string;
    default?: NonNullable<InputShapeFromField<Types, Type>>;
  };
  type<
    Type extends InputType<Types> | [InputType<Types>],
    Req extends boolean | { list: boolean; items: boolean }
  >(type: Type, options?: GiraphQLSchemaTypes.InputOptions<Types, Type, Req> | undefined) {
    return {
      description: options && options.description,
      required: options ? options.required : false,
      default: options && options.default,
      type,
    };
  }

  list<Type extends InputType<Types>>(
    type: Type,
  ): { type: [Type]; required: false; description?: string };
  list<Type extends InputType<Types>, Req extends boolean = false>(
    type: Type,
    options: GiraphQLSchemaTypes.InputOptions<Types, Type, Req> | undefined,
  ): {
    type: [Type];
    required: Req;
    description?: string;
    default?: NonNullable<InputShapeFromField<Types, Type>>;
  };
  list<Type extends InputType<Types>, Req extends boolean>(
    type: Type,
    options?: GiraphQLSchemaTypes.InputOptions<Types, Type, Req> | undefined,
  ) {
    return {
      description: options && options.description,
      required: options ? options.required : false,
      default: options && options.default,
      type: [type] as [Type],
    };
  }

  private helper<Type extends InputType<Types> | [InputType<Types>]>(type: Type) {
    function createType(): { type: Type; required: false; description?: string };
    function createType<Req extends boolean | { list: boolean; items: boolean } = false>(
      options: GiraphQLSchemaTypes.InputOptions<Types, Type, Req> | undefined,
    ): { type: Type; required: Req; description?: string };
    function createType<Req extends boolean | { list: boolean; items: boolean }>(
      options?: GiraphQLSchemaTypes.InputOptions<Types, Type, Req> | undefined,
    ) {
      return {
        description: options && options.description,
        required: options ? options.required : false,
        default: options && options.default,
        type,
      };
    }

    return createType;
  }
}
