import { FieldKind, RootFieldBuilder, SchemaTypes } from '@pothos/core';

export * from './edgedb-field-builder';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

// fieldBuilderProto.edgeDBField = function edgeDBField(...)
