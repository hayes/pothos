import { GraphQLInputObjectType, GraphQLInputFieldConfigMap } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import { InputFields } from '../types';
import BaseType from './base';
import { buildArg } from '../utils';
import InputFieldBuilder from '../fieldUtils/input';
import BuildCache from '../build-cache';

export default class InputObjectType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Shape,
  Name extends string
> extends BaseType<never, Shape> {
  kind: 'InputObject' = 'InputObject';

  options: GiraphQLSchemaTypes.InputTypeOptions<any, any>;

  constructor(
    name: Name,
    options: GiraphQLSchemaTypes.InputTypeOptions<Types, InputFields<Types>>,
  ) {
    super(name);

    this.options = options;
  }

  buildFields(cache: BuildCache): GraphQLInputFieldConfigMap {
    const fields = this.options.shape(new InputFieldBuilder());

    return fromEntries(
      Object.keys(fields).map(key => {
        const field = fields[key];
        return [
          key,
          {
            description:
              typeof field !== 'object' || field instanceof BaseType || Array.isArray(field)
                ? undefined
                : field.description,
            required:
              typeof field !== 'object' || field instanceof BaseType || Array.isArray(field)
                ? false
                : field.required ?? false,
            type: buildArg(field, cache),
          },
        ];
      }),
    );
  }

  buildType(cache: BuildCache) {
    return new GraphQLInputObjectType({
      name: this.typename,
      description: this.options.description,
      fields: () => this.buildFields(cache),
      extensions: this.options.extensions,
    });
  }
}
