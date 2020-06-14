import { InputType, SchemaTypes } from '../types';
import InputField from '../graphql/input-field';
import { FieldRequiredness, InputShapeFromTypeParam } from '..';

export default class InputFieldBuilder<Types extends SchemaTypes> {
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

  callableBuilder(): InputFieldBuilder<Types>['type'] & InputFieldBuilder<Types> {
    const builder: InputFieldBuilder<Types>['type'] = this.type.bind(this);

    ([...Object.keys(this), 'type'] as (keyof InputFieldBuilder<Types>)[]).forEach((key) => {
      ((builder as unknown) as { [s: string]: unknown })[key] = this[key];
    });

    return builder as InputFieldBuilder<Types> & typeof builder;
  }

  type<Type extends InputType<Types> | [InputType<Types>], Req extends FieldRequiredness<Type>>(
    options: GiraphQLSchemaTypes.InputOptions<Types, Type, Req>,
  ) {
    return new InputField<InputShapeFromTypeParam<Types, Type, Req>>(
      (options as unknown) as GiraphQLSchemaTypes.InputOptions,
    );
  }

  private helper<Type extends InputType<Types> | [InputType<Types>]>(type: Type) {
    return <Req extends FieldRequiredness<Type>>(
      options: Omit<GiraphQLSchemaTypes.InputOptions<Types, Type, Req>, 'type'>,
    ) => {
      return this.type({
        ...options,
        type,
      });
    };
  }
}
