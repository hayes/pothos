/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLNonNull } from 'graphql';
import fromEntries from 'object.fromentries';
import { TypeMap, TypeParam, FieldOptions, InputFields, ShapeFromTypeParam } from './types';
import TypeStore from './store';
import { typeFromParam, buildArg } from './utils';
import BaseType from './base';

export default class Field<
  Args extends InputFields<Types>,
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Nullable extends boolean = true,
  Context = {},
  Extends extends string | null = null,
  Options extends FieldOptions<Types, ParentType, Type, Nullable, Args, Context> = FieldOptions<
    Types,
    ParentType,
    Type,
    Nullable,
    Args,
    Context
  >
> {
  shape?: ShapeFromTypeParam<Types, Type, true>;

  nullable: Nullable;

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
    this.nullable = (options.nullable === true ? options.nullable : false) as Nullable;
    this.args = options.args || ({} as Args);
    this.extendsField = options.extendsField || (null as Extends);
    this.type = options.type;
  }

  buildArgs(store: TypeStore<Types>): GraphQLFieldConfigArgumentMap {
    return fromEntries(
      Object.keys(this.args).map(key => {
        const arg = this.args[key];

        return [
          key,
          {
            description:
              typeof arg !== 'object' || arg instanceof BaseType ? undefined : arg.description,
            required:
              typeof arg !== 'object' || arg instanceof BaseType ? false : arg.required || false,
            type: buildArg(arg, store),
          },
        ];
      }),
    );
  }

  build(name: string, store: TypeStore<Types>): GraphQLFieldConfig<unknown, unknown> {
    return {
      args: this.buildArgs(store),
      extensions: [],
      description: this.options.description || name,
      resolve: this.options.resolve as () => unknown,
      type: this.nullable
        ? typeFromParam(this.type, store)
        : new GraphQLNonNull(typeFromParam(this.type, store)),
    };
  }
}
