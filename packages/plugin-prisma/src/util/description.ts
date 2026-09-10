import type { SchemaTypes } from '@pothos/core';
import { getFieldData, getModel } from './datamodel.js';

/** Whether `exposeDescriptions` asks for the prisma schema's documentation for this kind. */
function exposed<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind: 'fields' | 'models',
) {
  const { exposeDescriptions } = builder.options.prisma;

  return (
    exposeDescriptions === true ||
    (typeof exposeDescriptions === 'object' && exposeDescriptions?.[kind] === true)
  );
}

export function getFieldDescription<Types extends SchemaTypes>(
  model: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  fieldName: string,
  description?: string | false,
) {
  return (
    (exposed(builder, 'fields')
      ? (description ?? getFieldData(model, builder, fieldName).documentation)
      : description) || undefined
  );
}

export function getModelDescription<Types extends SchemaTypes>(
  model: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  description?: string | false,
) {
  return (
    (exposed(builder, 'models')
      ? (description ?? getModel(model, builder).documentation)
      : description) || undefined
  );
}
