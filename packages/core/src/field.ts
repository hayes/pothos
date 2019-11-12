/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLNonNull } from 'graphql';
import fromEntries from 'object.fromentries';
import { TypeParam, InputFields, ShapeFromTypeParam } from './types';
import { typeFromParam, buildArg } from './utils';
import BaseType from './graphql/base';
import BasePlugin from './plugin';
import { BuildCache } from '.';

export default class Field<
  Args extends InputFields<Types>,
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Nullable extends boolean = true,
  Extends extends string | null = null,
  Options extends GiraphQLSchemaTypes.FieldOptions<
    Types,
    ParentType,
    Type,
    Nullable,
    Args
  > = GiraphQLSchemaTypes.FieldOptions<Types, ParentType, Type, Nullable, Args>
> {
  shape?: ShapeFromTypeParam<Types, Type, true>;

  nullable: Nullable;

  args: Args = {} as Args;

  extendsField: Extends;

  type: Type;

  options: Options;

  parentTypename: string;

  constructor(
    options: Options & {
      extendsField?: Extends;
    },
    parentTypename: string,
  ) {
    this.options = options;
    this.nullable = (options.nullable === true ? options.nullable : false) as Nullable;
    this.args = options.args ? options.args! : ({} as Args);
    this.extendsField = options.extendsField || (null as Extends);
    this.type = options.type;
    this.parentTypename = parentTypename;
  }

  private buildArgs(cache: BuildCache<Types>): GraphQLFieldConfigArgumentMap {
    return fromEntries(
      Object.keys(this.args).map(key => {
        const arg = this.args[key];

        return [
          key,
          {
            description:
              typeof arg !== 'object' || arg instanceof BaseType || Array.isArray(arg)
                ? undefined
                : arg.description,
            required:
              typeof arg !== 'object' || arg instanceof BaseType || Array.isArray(arg)
                ? false
                : arg.required || false,
            type: buildArg(arg, cache),
          },
        ];
      }),
    );
  }

  build(
    name: string,
    cache: BuildCache<Types>,
    plugins: BasePlugin<Types>[],
  ): GraphQLFieldConfig<unknown, unknown> {
    const baseConfig: GraphQLFieldConfig<unknown, unknown> = {
      args: this.buildArgs(cache),
      extensions: [],
      description: this.options.description || name,
      resolve: this.options.resolve as (...args: unknown[]) => unknown,
      type: this.nullable
        ? typeFromParam(this.type, cache)
        : new GraphQLNonNull(typeFromParam(this.type, cache)),
    };

    return plugins.reduce((config, plugin) => {
      return plugin.updateFieldConfig
        ? plugin.updateFieldConfig(
            name,
            // TODO figure out why this is complainings
            (this as unknown) as Field<
              InputFields<Types>,
              Types,
              TypeParam<Types>,
              TypeParam<Types>
            >,
            config,
            cache,
          )
        : config;
    }, baseConfig);
  }
}
