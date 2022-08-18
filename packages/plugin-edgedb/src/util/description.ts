import { SchemaTypes } from '@pothos/core';
import { getModel } from './datamodel';

export function getModelDescription<Types extends SchemaTypes>(
  model: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  description?: string | false,
) {
  const { exposeDescriptions } = builder.options.edgeDB;
  const useEdgeDBDescription = exposeDescriptions === true;
  // || (typeof exposeDescriptions === 'object' && exposeDescriptions?.models === true);

  return (
    // (useEdgeDBDescription ? description ?? getModel(model, builder).documentation : description) ||
    undefined
  );
}
