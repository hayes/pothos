import { TypeMap, TypeParam, FieldOptions, InputFields, ShapeFromTypeParam } from './types';

export default class FieldBuilder<
  Shape extends {},
  Types extends TypeMap,
  Context,
  Type extends TypeParam<Types>
> {
  field<
    T extends TypeParam<Types>,
    Name extends string,
    Req extends boolean,
    Args extends InputFields = {}
  >(
    name: Name,
    { type }: FieldOptions<Types, Type, T, Name, Req, Args, Context> & { required?: Req },
  ): FieldBuilder<
    Shape &
      {
        [K in Name]: ShapeFromTypeParam<Types, T, Req>;
      },
    Types,
    Context,
    Type
  > {
    throw new Error(`${this} not implemented`);
  }

  addValidator(validator: (item: Shape) => boolean) {
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
    return <Name extends string, Req extends boolean, Args extends InputFields = {}>(
      name: Name,
      options: Omit<FieldOptions<Types, Type, T, Name, Req, Args, Context>, 'type'>,
    ) => {
      // hack for now... for some reason omitting `type` field makes types unhappy
      return this.field(name, ({ ...options, type } as unknown) as FieldOptions<
        Types,
        Type,
        T,
        Name,
        Req,
        Args,
        Context
      >);
    };
  }
}
