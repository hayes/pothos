/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import { TypeParam, InputFields, ShapeFromTypeParam, FieldNullability } from '../types';
import { typeFromParam, buildArg } from '../utils';
import BaseType from './base';
import { BuildCache } from '..';
import { BasePlugin, wrapResolver } from '../plugins';

export default class Field {
  shape?: ShapeFromTypeParam;

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
    plugin: Required<BasePlugin>,
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

    const config = plugin.updateFieldConfig(name, this as any, baseConfig, cache);

    wrapResolver(name, this, config, plugin, cache);

    return config;
  }
}
