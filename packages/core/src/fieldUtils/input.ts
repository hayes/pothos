import {
  ArgBuilder,
  FieldRequiredness,
  InputFieldRef,
  InputShapeFromTypeParam,
  NormalizeArgs,
} from '../index.js';
import { InputType, SchemaTypes } from '../types/index.js';
import { inputTypeFromParam } from '../utils/index.js';

export default class InputFieldBuilder<
  Types extends SchemaTypes,
  Kind extends keyof GiraphQLSchemaTypes.InputFieldOptionsByKind,
> {
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  kind: Kind;

  typename: string;

  /**
   * Create a Boolean input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  boolean = this.helper('Boolean');

  /**
   * Create a Float input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  float = this.helper('Float');

  /**
   * Create a ID input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  id = this.helper('ID');

  /**
   * Create a Int input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  int = this.helper('Int');

  /**
   * Create a String input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  string = this.helper('String');

  /**
   * Create a Boolean list input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  booleanList = this.helper(['Boolean']);

  /**
   * Create a Float list input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  floatList = this.helper(['Float']);

  /**
   * Create a ID list input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  idList = this.helper(['ID']);

  /**
   * Create a Int list input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  intList = this.helper(['Int']);

  /**
   * Create a String list input field
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  stringList = this.helper(['String']);

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, kind: Kind, typename: string) {
    this.builder = builder;
    this.kind = kind;
    this.typename = typename;
  }

  argBuilder(): ArgBuilder<Types> {
    const builder = this.field.bind(this as never) as InputFieldBuilder<Types, 'Arg'>['field'];

    const protoKeys = Object.keys(Object.getPrototypeOf(this) as object).filter(
      (key) =>
        typeof (this as Record<string, unknown>)[key] === 'function' &&
        (Function.prototype as unknown as Record<string, unknown>)[key] === undefined,
    );

    ([...Object.keys(this), ...protoKeys] as (keyof InputFieldBuilder<Types, 'Arg'>)[]).forEach(
      (key) => {
        (builder as unknown as Record<string, unknown>)[key] =
          typeof this[key] === 'function' ? (this[key] as Function).bind(this) : this[key];
      },
    );

    return builder as ArgBuilder<Types>;
  }

  /**
   * Create in input field or argument for the current type
   * @param {GiraphQLSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  field<Type extends InputType<Types> | [InputType<Types>], Req extends FieldRequiredness<Type>>(
    options: GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind],
  ) {
    const ref: InputFieldRef<InputShapeFromTypeParam<Types, Type, Req>, Kind> = new InputFieldRef(
      this.kind,
      this.typename,
    );

    this.builder.configStore.addFieldRef(ref, options.type, {}, (name, parentField) => ({
      name,
      parentField,
      kind: this.kind,
      graphqlKind: this.kind,
      parentType: this.typename,
      type: inputTypeFromParam<Types>(
        options.type,
        this.builder.configStore,
        options.required ?? this.builder.defaultInputFieldRequiredness,
      ),
      giraphqlOptions:
        options as unknown as GiraphQLSchemaTypes.InputFieldOptionsByKind<Types>[Kind],
      description: options.description,
      deprecationReason: options.deprecationReason,
      defaultValue: options.defaultValue,
      extensions: options.extensions,
    }));

    return ref;
  }

  private helper<Type extends InputType<Types> | [InputType<Types>]>(type: Type) {
    return <Req extends FieldRequiredness<Type>>(
      ...args: NormalizeArgs<
        [
          options?: Omit<
            GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind],
            'type'
          >,
        ]
      >
    ) => {
      const [options = {} as never] = args;

      return this.field({
        ...options,
        type,
      } as GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind]);
    };
  }
}
