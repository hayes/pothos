import { GraphQLFieldConfigMap } from 'graphql';
import {
  TypeMap,
  TypeParam,
  FieldOptions,
  InputFields,
  UnknownString,
  InvalidType,
  FieldBuilderOptions,
  ModifyOptions,
} from './types';
import Field from './field';

export default class FieldBuilder<
  Fields extends { [s: string]: Field<string, Types, Type, TypeParam<Types>> },
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Context
> {
  options: FieldBuilderOptions<Types, Type, Fields>;

  constructor(options: FieldBuilderOptions<Types, Type, Fields>) {
    this.options = options;
  }

  field<
    T extends TypeParam<Types>,
    CheckedName extends UnknownString<
      U,
      keyof Fields,
      [CheckedName, 'is already defined for this type']
    >,
    Req extends boolean,
    Args extends InputFields = {},
    U extends string | InvalidType<unknown> = CheckedName,
    Name extends Extract<CheckedName, string> = Extract<CheckedName, string>,
    Options extends FieldOptions<Types, Type, T, Name, Req, Args, Context> = FieldOptions<
      Types,
      Type,
      T,
      Name,
      Req,
      Args,
      Context
    >
  >(
    name: Name,
    options: Options,
  ): FieldBuilder<
    Fields &
      {
        [K in Name]: Field<K, Types, Type, T, Req, Context, Args>;
      },
    Types,
    Type,
    Context
  > {
    const field = new Field<Name, Types, Type, T, Req, Context, Args>(name as Name, options);

    return new FieldBuilder({
      ...this.options,
      fields: {
        ...this.options.fields,
        [name as Extract<Name, string>]: field,
      },
    });
  }

  modify<Name extends keyof Fields>(
    name: Name,
    options: ModifyOptions<
      Types,
      Type,
      NonNullable<Fields[Name]['shape']>,
      Fields[Name]['required'],
      Fields[Name]['args'],
      Context
    >,
  ): this {
    throw new Error(`${this} not implemented`);
  }

  boolean = this.fieldTypeHelper('Boolean');

  float = this.fieldTypeHelper('Float');

  id = this.fieldTypeHelper('ID');

  int = this.fieldTypeHelper('Int');

  string = this.fieldTypeHelper('String');

  booleanList = this.fieldTypeHelper(['Boolean']);

  floatList = this.fieldTypeHelper(['Float']);

  idList = this.fieldTypeHelper(['ID']);

  intList = this.fieldTypeHelper(['Int']);

  stringList = this.fieldTypeHelper(['String']);

  private fieldTypeHelper<T extends TypeParam<Types>>(type: T) {
    return <
      CheckedName extends UnknownString<
        U,
        keyof Fields,
        [CheckedName, 'has already been defined for this type']
      >,
      Req extends boolean,
      Args extends InputFields = {},
      U extends string | InvalidType<unknown> = CheckedName,
      Name extends Extract<CheckedName, string> = Extract<CheckedName, string>
    >(
      name: CheckedName,
      options: Omit<FieldOptions<Types, Type, T, Name, Req, Args, Context>, 'type'>,
    ): FieldBuilder<
      Fields &
        {
          [K in Name]: Field<K, Types, Type, T, Req, Context, Args>;
        },
      Types,
      Type,
      Context
    > => {
      return this.field(
        // hack for now... for some reason omitting `type` field makes types unhappy
        // @ts-ignore
        name,
        { ...options, type },
      );
    };
  }

  build(): GraphQLFieldConfigMap<unknown, unknown> {
    throw new Error(`${this} not implemented yet`);
  }
}
