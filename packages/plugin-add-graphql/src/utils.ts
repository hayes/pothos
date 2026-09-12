import { createContextCache, type RootName, type SchemaTypes } from '@pothos/core';
import {
  type GraphQLNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql';

export const referencedTypes = createContextCache(() => new Set<GraphQLNamedType>());

/** The operation root each imported type was explicitly added as, by the name it was added with. */
export const importedRootKinds = createContextCache(() => new Map<string, RootName | null>());

/**
 * Whether the built schema's root for `kind` contradicts the `rootKind` its type was imported with.
 * A query root is exempt when the type was imported as a normal object, since a schema without a
 * query root is not valid.
 */
export function isUnintendedRoot<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  type: { name: string } | null | undefined,
  kind: RootName,
) {
  if (!type) {
    return false;
  }

  const importedKinds = importedRootKinds(builder);

  if (!importedKinds.has(type.name)) {
    return false;
  }

  const importedKind = importedKinds.get(type.name);

  if (importedKind === kind) {
    return false;
  }

  return importedKind === null ? kind !== 'Query' : true;
}

function hasRootType<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind: RootName,
) {
  for (const config of builder.configStore.typeConfigs.values()) {
    if (config.kind === kind) {
      return true;
    }
  }

  return false;
}

export function addTypeToSchema<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  type: GraphQLNamedType,
  rootKind?: RootName | null,
) {
  if (builder.configStore.hasConfig(type.name as never)) {
    return;
  }

  if (isObjectType(type)) {
    // A root the builder already defines is added as a normal object type rather than re-declaring
    // (and renaming) the existing root.
    builder.addGraphQLObject(type, {
      rootKind: rootKind && hasRootType(builder, rootKind) ? null : rootKind,
    });
  } else if (isInterfaceType(type)) {
    builder.addGraphQLInterface(type);
  } else if (isUnionType(type)) {
    builder.addGraphQLUnion(type);
  } else if (isEnumType(type)) {
    builder.addGraphQLEnum(type);
  } else if (isInputObjectType(type)) {
    builder.addGraphQLInput(type);
  } else if (isScalarType(type)) {
    builder.addScalarType(type.name as never, type);
  }
}
export function addReferencedType<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  type: GraphQLNamedType,
) {
  if (referencedTypes(builder).has(type)) {
    return;
  }

  builder.configStore.onPrepare(() => addTypeToSchema(builder, type));
}
