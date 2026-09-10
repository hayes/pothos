import './global-types.js';
import SchemaBuilder, {
  brandWithType,
  type InterfaceRef,
  isThenable,
  type OutputType,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import { PrismaInterfaceRef } from './interface-ref.js';
import { ModelLoader } from './model-loader.js';
import { PrismaNodeRef } from './node-ref.js';
import { PrismaObjectRef } from './object-ref.js';
import { PrismaObjectFieldBuilder } from './prisma-field-builder.js';
import type { PrismaModelTypes, PrismaNodeOptions } from './types.js';
import { getDefaultIDParser, getDefaultIDSerializer } from './util/cursors.js';
import { getDelegateFromModel, getRefFromModel } from './util/datamodel.js';
import { getModelDescription } from './util/description.js';
import { getClient, getDMMF } from './util/get-client.js';
import { queryFromInfo } from './util/map-query.js';
import { getRelationMap } from './util/relation-map.js';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

/**
 * The body of `prismaObject` and `prismaInterface`. The two build the same ref, extensions and
 * field builder; only the ref class and which of `objectType`/`interfaceType` registers it differ.
 */
function definePrismaType(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: string,
  {
    fields,
    findUnique,
    select,
    include,
    description,
    ...options
  }: {
    fields?: (t: PrismaObjectFieldBuilder<SchemaTypes, PrismaModelTypes>) => {};
    findUnique?: ((model: Record<string, unknown>, ctx: {}) => unknown) | null;
    select?: {};
    include?: {};
    description?: string | false;
    variant?: string;
    name?: string;
    extensions?: {};
  },
  kind: 'Interface' | 'Object',
) {
  const isInterface = kind === 'Interface';
  const ref = options.variant
    ? isInterface
      ? new PrismaInterfaceRef<SchemaTypes, PrismaModelTypes>(options.variant, type)
      : new PrismaObjectRef<SchemaTypes, PrismaModelTypes>(options.variant, type)
    : (getRefFromModel(type, builder, isInterface ? 'interface' : 'object') as PrismaObjectRef<
        SchemaTypes,
        PrismaModelTypes
      >);
  const name = options.variant ?? options.name ?? type;
  const fieldMap = getRelationMap(getDMMF(builder)).get(type)!;
  const idSelection = ModelLoader.getDefaultIDSelection(ref, type, builder);

  ref.name = name;

  const config = {
    ...options,
    description: getModelDescription(type, builder, description),
    extensions: {
      ...options.extensions,
      pothosPrismaInclude: include,
      pothosPrismaModel: type,
      pothosPrismaFieldMap: fieldMap,
      pothosPrismaSelect: select && { ...idSelection, ...select },
      pothosPrismaLoader: ModelLoader.forRef(ref, type, findUnique, builder),
    },
    name,
    fields: fields
      ? () => fields(new PrismaObjectFieldBuilder(name, builder, type, fieldMap, kind))
      : undefined,
  };

  if (isInterface) {
    builder.interfaceType(ref as never, config as never);
  } else {
    builder.objectType(ref as never, config as never);
  }

  return ref;
}

schemaBuilderProto.prismaObject = function prismaObject(type, options) {
  return definePrismaType(this, type, options as never, 'Object') as never;
};

schemaBuilderProto.prismaInterface = function prismaInterface(type, options) {
  return definePrismaType(this, type, options as never, 'Interface') as never;
};

schemaBuilderProto.prismaNode = function prismaNode(
  this: PothosSchemaTypes.SchemaBuilder<SchemaTypes> & {
    nodeInterfaceRef?: () => InterfaceRef<SchemaTypes, unknown>;
  },
  type: keyof SchemaTypes['PrismaTypes'],
  {
    id: { field, resolve: rawResolve, ...idOptions },
    findUnique: rawFindUnique,
    name,
    variant,
    nullable,
    ...options
  }: PrismaNodeOptions<SchemaTypes, PrismaModelTypes, [], never, {}, {}, undefined>,
) {
  const fieldName = field as unknown as string;
  const resolve = rawResolve ?? getDefaultIDSerializer(type, fieldName, this);
  const idParser = fieldName ? getDefaultIDParser(type, fieldName, this) : undefined;
  const typeName = variant ?? name ?? type;
  const nodeRef = new PrismaNodeRef(typeName, type);
  const findUnique = rawFindUnique
    ? (parent: unknown, context: {}) =>
        rawFindUnique(resolve(parent as never, context) as string, context)
    : ModelLoader.getFindUniqueForField(nodeRef, type, fieldName, this);

  const extendedOptions = {
    ...options,
    name,
    variant,
    findUnique,
  };

  const ref = this.prismaObject(type, extendedOptions as never);

  // Built once per node type: loading with a synchronous plan issues the query in the same tick,
  // without a promise or closure of its own.
  const loadNode = (query: object, id: string, context: SchemaTypes['Context']) => {
    const delegate = getDelegateFromModel(getClient(this, context), type);
    const where = rawFindUnique ? rawFindUnique(id, context) : { [fieldName]: idParser!(id) };

    return (
      delegate.findUniqueOrThrow && !nullable
        ? delegate.findUniqueOrThrow({ ...query, where } as never)
        : delegate.findUnique({
            ...query,
            ...(nullable ? {} : { rejectOnNotFound: true }),
            where,
          } as never)
    ).then((record: unknown) => {
      brandWithType(record, typeName as OutputType<SchemaTypes>);

      return record;
    });
  };

  (this as typeof this & { nodeRef: (ref: unknown, options: unknown) => unknown }).nodeRef(ref, {
    id: {
      ...idOptions,
      resolve: (parent: never, _args: object, context: object) => resolve(parent, context),
    },
    loadWithoutCache: (id: string, context: SchemaTypes['Context'], info: GraphQLResolveInfo) => {
      // A promise while a select beneath the node is async (A-7); the query waits only then.
      const query = queryFromInfo({
        context,
        info,
        typeName,
        skipDeferredFragments: this.options.prisma?.skipDeferredFragments,
      });

      return isThenable(query)
        ? query.then((settled) => loadNode(settled as object, id, context))
        : loadNode(query, id, context);
    },
  });

  this.configStore.associateParamWithRef(nodeRef, ref);

  return nodeRef;
} as never;

/** The body of `prismaObjectField(s)` and `prismaInterfaceField(s)`: they differ only in kind. */
function addPrismaFields(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: string | PrismaObjectRef<SchemaTypes, PrismaModelTypes>,
  fields: (t: PrismaObjectFieldBuilder<SchemaTypes, PrismaModelTypes>) => {},
  graphqlKind?: 'Interface',
) {
  // A model name names the interface registered under it, as `prismaInterface` registers one.
  const ref =
    typeof type === 'string'
      ? getRefFromModel(type, builder, graphqlKind ? 'interface' : 'object')
      : type;

  builder.configStore.onTypeConfig(ref, ({ name }) => {
    builder.configStore.addFields(ref, () =>
      fields(
        new PrismaObjectFieldBuilder(
          name,
          builder,
          ref.modelName,
          getRelationMap(getDMMF(builder)).get(ref.modelName)!,
          graphqlKind,
        ),
      ),
    );
  });
}

schemaBuilderProto.prismaObjectField = function prismaObjectField(type, fieldName, field) {
  addPrismaFields(this, type as never, (t) => ({ [fieldName]: field(t as never) }));
};

schemaBuilderProto.prismaInterfaceField = function prismaInterfaceField(type, fieldName, field) {
  addPrismaFields(this, type as never, (t) => ({ [fieldName]: field(t as never) }), 'Interface');
};

schemaBuilderProto.prismaObjectFields = function prismaObjectFields(type, fields) {
  addPrismaFields(this, type as never, fields as never);
};

schemaBuilderProto.prismaInterfaceFields = function prismaInterfaceFields(type, fields) {
  addPrismaFields(this, type as never, fields as never, 'Interface');
};
