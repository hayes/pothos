/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GraphQLField } from 'graphql';
import { TypeMap, TypeParam, FieldOptions, InputFields, ShapeFromTypeParam } from './types';

export default class Field<
  Args extends InputFields,
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Req extends boolean = false,
  Context = {},
  Options extends FieldOptions<Types, ParentType, Type, Req, Args, Context> = FieldOptions<
    Types,
    ParentType,
    Type,
    Req,
    Args,
    Context
  >
> {
  shape?: ShapeFromTypeParam<Types, Type, true>;

  required: Req;

  args: Args = {} as Args;

  // type: string;

  options: Options;

  constructor(options: Options) {
    this.options = options;
    this.required = options.required || (false as Req);
    this.args = options.args || ({} as Args);

    // const typeParam = this.options.type;

    // this.type = typeof typeParam === 'function' ? typeParam() : type;
  }

  build(name: string): GraphQLField<unknown, unknown> {
    return {
      name,
      args: [],
      extensions: [],
      description: this.options.description || name,
      type: {} as any,
    };
  }
}
