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
    // If the builder already defines this operation root, the imported type is added as a normal
    // object type rather than re-declaring (and renaming) the existing root.
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
