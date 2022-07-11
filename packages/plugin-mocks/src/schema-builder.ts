import SchemaBuilder, { SchemaTypes } from '@pothos/core';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.createObjectMock = function createMock(nameOrRef, resolver) {
  const name = typeof nameOrRef === 'string' ? nameOrRef : (nameOrRef as { name: string }).name;

  return {
    name,
    resolver: resolver as never,
  };
};
