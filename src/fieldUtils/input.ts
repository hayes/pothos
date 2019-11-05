import { TypeMap, InputType, InputOptions } from '../types';

/* eslint-disable unicorn/consistent-function-scoping */
export default class InputFieldBuilder<Types extends TypeMap> {
  bool = this.helper('Boolean');

  float = this.helper('Float');

  id = this.helper('ID');

  int = this.helper('Int');

  string = this.helper('String');

  type<Type extends InputType<Types>>(
    type: Type,
  ): { type: Type; required: false; description?: string };
  type<Type extends InputType<Types>, Req extends boolean = false>(
    type: Type,
    options: InputOptions<Req> | undefined,
  ): { type: Type; required: Req; description?: string };
  type<Type extends InputType<Types>, Req extends boolean>(
    type: Type,
    options?: InputOptions<Req> | undefined,
  ) {
    return {
      description: options && options.description,
      required: options ? options.required : false,
      type,
    };
  }

  callableBuilder() {
    const builder = <Type extends InputType<Types>, Req extends boolean = false>(
      type: Type,
      options?: InputOptions<Req>,
    ): { type: Type } & InputOptions<Req> => this.type(type, options);

    (Object.keys(this) as (keyof InputFieldBuilder<Types>)[]).forEach(key => {
      ((builder as unknown) as { [s: string]: unknown })[key] = this[key];
    });

    return builder as InputFieldBuilder<Types> & typeof builder;
  }

  private helper<Type extends InputType<Types>>(type: Type) {
    function createType(): { type: Type; required: false; description?: string };
    function createType<Req extends boolean = false>(
      options: InputOptions<Req> | undefined,
    ): { type: Type; required: Req; description?: string };
    function createType<Req extends boolean>(options?: InputOptions<Req> | undefined) {
      return {
        description: options && options.description,
        required: options ? options.required : false,
        type,
      };
    }

    return createType;
  }
}
