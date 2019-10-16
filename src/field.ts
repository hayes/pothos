/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GraphQLField } from 'graphql';
import { TypeMap, TypeParam, FieldOptions, InputFields, ShapeFromTypeParam } from './types';

export default class Field<
  Name extends string,
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Req extends boolean = false,
  Context = {},
  Args extends InputFields = {},
  Options extends FieldOptions<Types, ParentType, Type, Name, Req, Args, Context> = FieldOptions<
    Types,
    ParentType,
    Type,
    Name,
    Req,
    Args,
    Context
  >
> {
  name: Name;

  shape?: ShapeFromTypeParam<Types, Type, true>;

  required: Req;

  args: Args = {} as Args;

  // type: string;

  options: Options;

  constructor(name: Name, options: Options) {
    this.name = name;
    this.options = options;
    this.required = options.required || (false as Req);
    this.args = options.args || ({} as Args);

    // const typeParam = this.options.type;

    // this.type = typeof typeParam === 'function' ? typeParam() : type;
  }

  build(): GraphQLField<unknown, unknown> {
    return {
      name: this.name,
      args: [],
      extensions: [],
      description: this.options.description || this.name,
      type: {} as any,
    };
  }
}
