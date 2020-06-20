import { InputType, SchemaTypes } from '../types';
import InputField from '../input-field';
import { FieldRequiredness, InputShapeFromTypeParam, ArgBuilder } from '..';

export default class InputFieldBuilder<Types extends SchemaTypes> {
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  kind: 'InputObject' | 'Arg';

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, kind: 'InputObject' | 'Arg') {
    this.builder = builder;
    this.kind = kind;
  }

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

  argBuilder(): ArgBuilder<Types> {
    const builder: InputFieldBuilder<Types>['field'] = this.field.bind(this);

    ([...Object.keys(this)] as (keyof InputFieldBuilder<Types>)[]).forEach((key) => {
      ((builder as unknown) as { [s: string]: unknown })[key] =
        typeof this[key] === 'function' ? (this[key] as Function).bind(this) : this[key];
    });

    return builder as ArgBuilder<Types>;
  }

  field<Type extends InputType<Types> | [InputType<Types>], Req extends FieldRequiredness<Type>>(
    options: GiraphQLSchemaTypes.InputFieldOptions<Types, Type, Req>,
  ) {
    return new InputField<InputShapeFromTypeParam<Types, Type, Req>>(
      (options as unknown) as GiraphQLSchemaTypes.InputFieldOptions,
    );
  }

  private helper<Type extends InputType<Types> | [InputType<Types>]>(type: Type) {
    return <Req extends FieldRequiredness<Type>>(
      options: Omit<GiraphQLSchemaTypes.InputFieldOptions<Types, Type, Req>, 'type'>,
    ) => {
      return this.field({
        ...options,
        type,
      });
    };
  }
}
