import type { BuildCache, PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';

/**
 * The types whose loader mappings answer for a field: its parent type, and each interface of it
 * that has a model and declares the same field. Pothos builds an inherited field from the
 * interface's options, so an implementation that redefines the field (other relation arguments,
 * say) does not read what the interface's field loaded.
 */
export function mappingParentTypes<Types extends SchemaTypes>(
  buildCache: BuildCache<Types>,
  fieldConfig: PothosOutputFieldConfig<Types>,
  modelExtension: string,
): Set<string> {
  const parentTypes = new Set([fieldConfig.parentType]);
  const parentConfig = buildCache.getTypeConfig(fieldConfig.parentType);

  if (parentConfig.kind !== 'Interface' && parentConfig.kind !== 'Object') {
    return parentTypes;
  }

  for (const iface of parentConfig.interfaces) {
    const { name, extensions } = buildCache.getTypeConfig(iface, 'Interface');
    const ifaceField = buildCache.builder.configStore
      .getFields(name, 'Interface')
      .get(fieldConfig.name);

    if (extensions?.[modelExtension] && ifaceField?.pothosOptions === fieldConfig.pothosOptions) {
      parentTypes.add(name);
    }
  }

  return parentTypes;
}
