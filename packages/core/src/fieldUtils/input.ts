import { InputType, SchemaTypes } from '../types';
import { FieldRequiredness, InputShapeFromTypeParam, ArgBuilder, InputFieldRef } from '..';
import { inputTypeFromParam } from '../utils';

export default class InputFieldBuilder<
  Types extends SchemaTypes,
  Kind extends 'InputObject' | 'Arg'
> {
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  kind: Kind;

  typename: string;

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

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, kind: Kind, typename: string) {
    this.builder = builder;
    this.kind = kind;
    this.typename = typename;
  }

  argBuilder(): ArgBuilder<Types> {
    const builder: InputFieldBuilder<Types, 'Arg'>['field'] = this.field.bind(this);

    ([...Object.keys(this)] as (keyof InputFieldBuilder<Types, 'Arg'>)[]).forEach((key) => {
      ((builder as unknown) as { [s: string]: unknown })[key] =
        typeof this[key] === 'function' ? (this[key] as Function).bind(this) : this[key];
    });

    return builder as ArgBuilder<Types>;
  }

  field<Type extends InputType<Types> | [InputType<Types>], Req extends FieldRequiredness<Type>>(
    options: GiraphQLSchemaTypes.InputFieldOptions<Types, Type, Req>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ref: InputFieldRef<InputShapeFromTypeParam<Types, Type, Req>, Kind> = {} as any;

    this.builder.configStore.addFieldRef(ref, options.type, (name) => ({
        name,
        kind: this.kind,
        graphqlKind: this.kind,
        parentType: this.typename,
        type: inputTypeFromParam<Types>(
          options.type,
          this.builder.configStore,
          options.required ?? false,
        ),
        giraphqlOptions: (options as unknown) as GiraphQLSchemaTypes.InputFieldOptions<Types>,
        description: options.description,
        defaultValue: options.defaultValue,
      }));

    return ref;
  }

  private helper<Type extends InputType<Types> | [InputType<Types>]>(type: Type) {
    return <Req extends FieldRequiredness<Type>>(
      options: Omit<GiraphQLSchemaTypes.InputFieldOptions<Types, Type, Req>, 'type'>,
    ) => this.field({
        ...options,
        type,
      });
  }
}
