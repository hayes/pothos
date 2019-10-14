import {
  TypeMap,
  TypeParam,
  FieldOptions,
  InputFields,
  ShapeFromTypeParam,
  UnknownString,
  InvalidType,
} from './types';

export default class FieldBuilder<
  Shape extends {},
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Context
> {
  shape?: Shape;

  field<
    T extends TypeParam<Types>,
    Name extends UnknownString<U, keyof Shape, [Name, 'is already defined for this type']>,
    Req extends boolean,
    Args extends InputFields = {},
    U extends string | InvalidType<unknown> = Name
  >(
    name: Name,
    {
      type,
    }: FieldOptions<Types, Type, T, Extract<Name, string>, Req, Args, Context> & { required?: Req },
  ): FieldBuilder<
    Shape &
      {
        [K in Extract<Name, string>]: ShapeFromTypeParam<Types, T, Req>;
      },
    Types,
    Type,
    Context
  > {
    throw new Error(`${this} not implemented`);
  }

  addValidator(validator: (item: Shape) => boolean) {
    throw new Error(`${this} not implemented`);
  }

  modify<Name extends keyof Shape>(
    name: Name,
    options: {
      resolver?: () => Shape[Name];
    },
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
      Name extends UnknownString<U, keyof Shape, [Name, 'has already been defined for this type']>,
      Req extends boolean,
      Args extends InputFields = {},
      U extends string | InvalidType<unknown> = Name
    >(
      name: Name,
      options: Omit<
        FieldOptions<Types, Type, T, Extract<Name, string>, Req, Args, Context>,
        'type'
      >,
    ): FieldBuilder<
      Shape &
        {
          [K in Extract<Name, string>]: ShapeFromTypeParam<Types, T, Req>;
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
}
