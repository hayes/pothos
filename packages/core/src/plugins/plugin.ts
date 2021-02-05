import { GraphQLSchema } from 'graphql';
import {
  SchemaTypes,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  GiraphQLInputFieldConfig,
  GiraphQLEnumValueConfig,
} from '../types';
import BaseFieldWrapper from './field-wrapper';

export { BaseFieldWrapper };

export class BasePlugin<Types extends SchemaTypes> {
  name: keyof GiraphQLSchemaTypes.Plugins<Types>;

  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  constructor(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    name: keyof GiraphQLSchemaTypes.Plugins<Types>,
  ) {
    this.name = name;
    this.builder = builder;
  }

  onTypeConfig(typeConfig: GiraphQLTypeConfig) {}

  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {}

  onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {}

  onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {}

  beforeBuild(options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {}

  afterBuild(schema: GraphQLSchema, options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {}

  wrapOutputField(
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ): BaseFieldWrapper<Types> | BaseFieldWrapper<Types>[] | null {
    return null;
  }

  usesFieldWrapper() {
    return this.wrapOutputField !== BasePlugin.prototype.wrapOutputField;
  }
}
