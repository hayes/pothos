import { InputType, SchemaTypes } from '../types';
import {
  FieldRequiredness,
  InputShapeFromTypeParam,
  ArgBuilder,
  InputFieldRef,
  InputTypeParam,
} from '..';
import { inputTypeFromParam } from '../utils';

export default class InputFieldBuilder<Types extends SchemaTypes> {
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  kind: 'InputObject' | 'Arg';

  typename: string;

  constructor(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    kind: 'InputObject' | 'Arg',
    typename: string,
  ) {
    this.builder = builder;
    this.kind = kind;
    this.typename = typename;
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
    const ref: InputFieldRef<InputShapeFromTypeParam<Types, Type, Req>> = {} as any;

    this.builder.configStore.addFieldRef(ref, options.type, (name) => {
      return {
        name,
        kind: this.kind,
        graphqlKind: this.kind,
        parentType: this.typename,
        type: inputTypeFromParam<Types>(
          options.type,
          this.builder.configStore,
          options.required ?? false,
        ),
        giraphqlOptions: options as GiraphQLSchemaTypes.InputFieldOptions<
          Types,
          InputTypeParam<Types>,
          FieldRequiredness<[unknown]>
        >,
        description: options.description,
        defaultValue: options.defaultValue,
      };
    });

    return ref;
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
