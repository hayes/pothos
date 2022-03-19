import SchemaBuilder, { SchemaTypes } from '@pothos/core';

export const schemaBuilderProto =
  SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
