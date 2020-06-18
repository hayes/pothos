import { GraphQLInputFieldConfig, GraphQLArgumentConfig } from 'graphql';
// @ts-ignore
import { inputTypeFromParam } from './utils';
import { BuildCache, InputType, SchemaTypes, inputFieldShapeKey, PartialInput } from '.';

export default class InputField<T> implements PartialInput {
  kind: 'InputField' = 'InputField';

  [inputFieldShapeKey]: T;

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
      type: inputTypeFromParam(this.type, cache, this.required),
      extensions: {
        ...this.options.extensions,
        giraphqlOptions: this.options,
      },
    };
  }
}
