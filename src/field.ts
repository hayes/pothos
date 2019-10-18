/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GraphQLFieldConfig } from 'graphql';
import { TypeMap, TypeParam, FieldOptions, InputFields, ShapeFromTypeParam } from './types';
import TypeStore from './store';
import { typeFromParam } from './utils';

export default class Field<
  Args extends InputFields,
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Req extends boolean = false,
  Context = {},
  Extends extends string | null = null,
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

  extendsField: Extends;

  type: Type;

  options: Options;

  constructor(
    options: Options & {
      extendsField?: Extends;
    },
  ) {
    this.options = options;
    this.required = options.required || (false as Req);
    this.args = options.args || ({} as Args);
    this.extendsField = options.extendsField || (null as Extends);
    this.type = options.type;

    // const typeParam = this.options.type;

    // this.type = typeof typeParam === 'function' ? typeParam() : type;
  }

  build(name: string, store: TypeStore<Types>): GraphQLFieldConfig<unknown, unknown> {
    return {
      args: {},
      extensions: [],
      description: this.options.description || name,
      type: typeFromParam(this.type, store),
    };
  }
}
