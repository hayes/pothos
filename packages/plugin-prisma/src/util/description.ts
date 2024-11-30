import type { SchemaTypes } from '@pothos/core';
import { getFieldData, getModel } from './datamodel';

export function getFieldDescription<Types extends SchemaTypes>(
  model: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  fieldName: string,
  description?: string | false,
) {
  const { exposeDescriptions } = builder.options.prisma;
  const usePrismaDescription =
    exposeDescriptions === true ||
    (typeof exposeDescriptions === 'object' && exposeDescriptions?.fields === true);

  return (
    (usePrismaDescription
      ? (description ?? getFieldData(model, builder, fieldName).documentation)
      : description) || undefined
  );
}

export function getModelDescription<Types extends SchemaTypes>(
  model: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  description?: string | false,
) {
  const { exposeDescriptions } = builder.options.prisma;
  const usePrismaDescription =
    exposeDescriptions === true ||
    (typeof exposeDescriptions === 'object' && exposeDescriptions?.models === true);

  return (
    (usePrismaDescription
      ? (description ?? getModel(model, builder).documentation)
      : description) || undefined
  );
}
