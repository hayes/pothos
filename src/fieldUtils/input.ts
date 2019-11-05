import { TypeMap, InputType, InputOptions } from '../types';

/* eslint-disable unicorn/consistent-function-scoping */
export default class InputFieldBuilder<Types extends TypeMap> {
  bool = this.helper('Boolean');

  float = this.helper('Float');

  id = this.helper('ID');

  int = this.helper('Int');

  string = this.helper('String');

  type = <Type extends InputType<Types>>(type: Type, options?: InputOptions) => ({
    ...options,
    type,
  });

  callableBuilder() {
    const builder = <Type extends InputType<Types>>(type: Type, options?: InputOptions) =>
      this.type(type, options);

    (Object.keys(this) as (keyof InputFieldBuilder<Types>)[]).forEach(key => {
      ((builder as unknown) as { [s: string]: unknown })[key] = this[key];
    });

    return builder as InputFieldBuilder<Types> & typeof builder;
  }

  private helper<Type extends InputType<Types>>(type: Type) {
    return (options?: InputOptions) => ({
      ...options,
      type,
    });
  }
}
