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
  Fields extends InputFields<Types>,
  Name extends string,
  MatchShape = Shape
> extends BaseType<Types, Name, Shape, Shape, MatchShape> {
  kind: 'InputObject' = 'InputObject';

  fields: Fields;

  options: GiraphQLSchemaTypes.InputTypeOptions<Types, InputFields<Types>>;

  constructor(name: Name, options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>) {
    super(name);

    this.fields = options.shape(new InputFieldBuilder());

    this.options = options;
  }

  buildFields(cache: BuildCache<Types>): GraphQLInputFieldConfigMap {
    return fromEntries(
      Object.keys(this.fields).map(key => {
        const field = this.fields[key];
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
                : field.required || false,
            type: buildArg(field, cache),
          },
        ];
      }),
    );
  }

  buildType(cache: BuildCache<Types>) {
    return new GraphQLInputObjectType({
      name: this.typename,
      description: this.options.description,
      fields: () => this.buildFields(cache),
      extensions: this.options.extensions,
    });
  }
}
