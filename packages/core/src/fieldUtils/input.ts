import { ArgumentRef } from '../refs/arg';
import { InputFieldRef } from '../refs/input-field';
import { InputListRef } from '../refs/input-list';
import type {
  ArgBuilder,
  FieldRequiredness,
  InputOrArgRef,
  InputShapeFromTypeParam,
  InputTypeParam,
  NormalizeArgs,
} from '../types';
import { InputType, SchemaTypes } from '../types';
import { inputTypeFromParam } from '../utils';

export class InputFieldBuilder<
  Types extends SchemaTypes,
  Kind extends keyof PothosSchemaTypes.InputFieldOptionsByKind,
> {
  kind: Kind;

  builder: PothosSchemaTypes.SchemaBuilder<Types>;

  /**
   * Create a Boolean input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  boolean = this.helper('Boolean');

  /**
   * Create a Float input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  float = this.helper('Float');

  /**
   * Create a ID input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  id = this.helper('ID');

  /**
   * Create a Int input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  int = this.helper('Int');

  /**
   * Create a String input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  string = this.helper('String');

  /**
   * Create a Boolean list input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  booleanList = this.helper(['Boolean']);

  /**
   * Create a Float list input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  floatList = this.helper(['Float']);

  /**
   * Create a ID list input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  idList = this.helper(['ID']);

  /**
   * Create a Int list input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  intList = this.helper(['Int']);

  /**
   * Create a String list input field
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  stringList = this.helper(['String']);

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, kind: Kind) {
    this.builder = builder;
    this.kind = kind;
  }

  listRef = <T extends InputTypeParam<Types>, Required extends boolean = true>(
    type: T,
    options?: { required?: Required },
  ): InputListRef<Types, InputShapeFromTypeParam<Types, T, Required>[]> =>
    new InputListRef<Types, InputShapeFromTypeParam<Types, T, Required>[]>(
      type,
      options?.required ?? true,
    );

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
   * @param {PothosSchemaTypes.InputFieldOptions} [options={}] - Options for this field
   */
  field<Type extends InputType<Types> | [InputType<Types>], Req extends FieldRequiredness<Type>>(
    options: PothosSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind],
  ): InputOrArgRef<Types, InputShapeFromTypeParam<Types, Type, Req>, Kind> {
    const ref =
      this.kind === 'Arg'
        ? new ArgumentRef<Types>((name, field, typeConfig) => {
            const opts = options as PothosSchemaTypes.ArgFieldOptions<Types>;

            return {
              name,
              parentField: field,
              kind: this.kind,
              graphqlKind: this.kind,
              parentType: typeConfig.name,
              type: inputTypeFromParam<Types>(
                opts.type,
                this.builder.configStore,
                opts.required ?? this.builder.defaultInputFieldRequiredness,
              ),
              pothosOptions: opts,
              description: opts.description,
              deprecationReason: opts.deprecationReason,
              defaultValue: opts.defaultValue,
              extensions: opts.extensions ?? {},
            };
          })
        : new InputFieldRef<Types>((name, typeConfig) => {
            const opts = options as PothosSchemaTypes.InputFieldOptions<Types>;

            return {
              name,
              parentField: undefined,
              kind: this.kind,
              graphqlKind: this.kind,
              parentType: typeConfig.name,
              type: inputTypeFromParam<Types>(
                opts.type,
                this.builder.configStore,
                opts.required ?? this.builder.defaultInputFieldRequiredness,
              ),
              pothosOptions: opts,
              description: opts.description,
              deprecationReason: opts.deprecationReason,
              defaultValue: opts.defaultValue,
              extensions: opts.extensions ?? {},
            };
          });

    return ref as InputOrArgRef<Types, InputShapeFromTypeParam<Types, Type, Req>, Kind>;
  }

  private helper<Type extends InputType<Types> | [InputType<Types>]>(type: Type) {
    return <Req extends FieldRequiredness<Type>>(
      ...args: NormalizeArgs<
        [options: Omit<PothosSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind], 'type'>]
      >
    ) => {
      const [options = {} as never] = args;

      return this.field({
        ...options,
        type,
      } as PothosSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind]);
    };
  }
}
