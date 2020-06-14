import { GraphQLInputFieldConfig, GraphQLArgumentConfig } from 'graphql';
// @ts-ignore
import { inputTypeFromParam } from '../utils';
import { BuildCache, InputType, SchemaTypes, partialInputShapeKey, PartialInput } from '..';

export default class InputField<T> implements PartialInput {
  kind: 'InputField' = 'InputField';

  [partialInputShapeKey]: T;

  required: boolean | { list: boolean; items: boolean };

  type: InputType<SchemaTypes> | [InputType<SchemaTypes>];

  options: GiraphQLSchemaTypes.InputOptions;

  constructor(options: GiraphQLSchemaTypes.InputOptions) {
    this.options = options;
    this.required = options.required ?? false;
    this.type = options.type;
  }

  // This is currently used to for fields on Input Objects, and Arguments on Fields
  build(cache: BuildCache): GraphQLInputFieldConfig & GraphQLArgumentConfig {
    return {
      description: this.options.description,
      defaultValue: this.options.defaultValue,
      extensions: this.options.extensions,
      type: inputTypeFromParam(this.type, cache, this.required),
    };
  }
}
