import SchemaBuilder, { BasePlugin, SchemaTypes, GiraphQLOutputFieldConfig } from '@giraphql/core';
import { ZodFieldWrapper } from './field-wrapper';
import './global-types';

export default class ZodPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  name: 'GiraphQLZod' = 'GiraphQLZod';

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'GiraphQLZod');
  }

  wrapOutputField(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    return new ZodFieldWrapper(fieldConfig);
  }
}

SchemaBuilder.registerPlugin('GiraphQLZod', ZodPlugin);
