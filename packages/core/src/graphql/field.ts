/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  GraphQLFieldConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLInterfaceType,
  GraphQLObjectType,
} from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import { TypeParam, InputFields, FieldNullability } from '../types';
import { typeFromParam } from '../utils';
import { BuildCache } from '..';
import { BasePlugin, wrapResolver } from '../plugins';

export default class Field {
  nullable: FieldNullability;

  args: InputFields;

  type: TypeParam;

  options: GiraphQLSchemaTypes.FieldOptions;

  parentTypename: string;

  constructor(options: GiraphQLSchemaTypes.FieldOptions, parentTypename: string) {
    this.options = options;
    this.nullable = options.nullable ?? false;
    this.args = options.args ? options.args! : ({} as InputFields);
    this.type = options.type;
    this.parentTypename = parentTypename;
  }

  protected buildArgs(cache: BuildCache): GraphQLFieldConfigArgumentMap {
    return fromEntries(
      Object.keys(this.args).map((key) => {
        const arg = this.args[key];

        return [key, arg.build(cache)];
      }),
    ) as GraphQLFieldConfigArgumentMap;
  }

  build(
    type: GraphQLObjectType | GraphQLInterfaceType,
    name: string,
    cache: BuildCache,
    plugin: Required<BasePlugin>,
  ): GraphQLFieldConfig<unknown, object> {
    const baseConfig: GraphQLFieldConfig<unknown, object> = {
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

    const config = plugin.updateFieldConfig(name, baseConfig, cache);

    wrapResolver(type, name, config, plugin, cache);

    return config;
  }
}
