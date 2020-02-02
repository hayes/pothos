/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import { TypeParam, InputFields, ShapeFromTypeParam, FieldNullability } from '../types';
import { typeFromParam, buildArg } from '../utils';
import BaseType from './base';
import BasePlugin from '../plugin';
import { BuildCache } from '..';

export default class Field<
  Args extends InputFields<Types>,
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Type extends TypeParam<Types>
> {
  shape?: ShapeFromTypeParam<Types, Type, true>;

  nullable: FieldNullability<Type>;

  args: Args = {} as Args;

  type: Type;

  options: GiraphQLSchemaTypes.FieldOptions<any, unknown, TypeParam<any>, FieldNullability, any>;

  parentTypename: string;

  constructor(
    options: GiraphQLSchemaTypes.FieldOptions<Types, any, Type, FieldNullability<Type>, Args>,
    parentTypename: string,
  ) {
    this.options = options;
    this.nullable = options.nullable ?? false;
    this.args = options.args ? options.args! : ({} as Args);
    this.type = options.type;
    this.parentTypename = parentTypename;
  }

  protected buildArgs(cache: BuildCache): GraphQLFieldConfigArgumentMap {
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
                : arg.required ?? false,
            type: buildArg(arg, cache),
            defaultValue:
              typeof arg !== 'object' || arg instanceof BaseType || Array.isArray(arg)
                ? undefined
                : arg.default,
          },
        ];
      }),
    );
  }

  build(
    name: string,
    cache: BuildCache,
    plugins: BasePlugin[],
  ): GraphQLFieldConfig<unknown, unknown> {
    const baseConfig: GraphQLFieldConfig<unknown, unknown> = {
      args: this.buildArgs(cache),
      description: this.options.description,
      resolve:
        cache.resolverMock(this.parentTypename, name) ??
        (this.options as { resolve?: (...args: unknown[]) => unknown }).resolve ??
        (() => {
          throw new Error(`Not implemented: No resolver found for ${this.parentTypename}.${name}`);
        }),
      subscribe:
        cache.subscribeMock(this.parentTypename, name) ??
        (this.options as { subscribe?: (...args: unknown[]) => unknown }).subscribe,
      type: typeFromParam(this.type, cache, this.nullable),
      extensions: this.options.extensions,
    };

    return plugins.reduce((config, plugin) => {
      return plugin.updateFieldConfig
        ? plugin.updateFieldConfig(name, this as any, config, cache)
        : config;
    }, baseConfig);
  }
}
