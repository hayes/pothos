import { type SchemaTypes, createContextCache } from '@pothos/core';
import type { PrismaClient } from '../types';

export interface DMMFField {
  type: string;
  kind: string;
  name: string;
  isRequired: boolean;
  isList: boolean;
  hasDefaultValue: boolean;
  isUnique: boolean;
  isId: boolean;
  documentation?: string;
  relationName?: string;
  relationFromFields?: string[];
  isUpdatedAt?: boolean;
}

export interface DMMF {
  datamodel: {
    models: {
      name: string;
      fields: DMMFField[];
      primaryKey: { name: string | null; fields: string[] } | null;
      uniqueIndexes: { name: string | null; fields: string[] }[];
      documentation?: string;
    }[];
  };
}

export interface RuntimeDataModel {
  models: Record<
    string,
    {
      fields: DMMFField[];
      primaryKey: { name: string | null; fields: string[] } | null;
      uniqueIndexes: { name: string | null; fields: string[] }[];
      documentation?: string;
    }
  >;
}

export const prismaClientCache = createContextCache(
  (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) =>
    createContextCache((context: object) =>
      typeof builder.options.prisma.client === 'function'
        ? builder.options.prisma.client(context)
        : builder.options.prisma.client,
    ),
);

export function getClient<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: Types['Context'],
): PrismaClient {
  if (typeof builder.options.prisma.client === 'function') {
    return prismaClientCache(builder as unknown as PothosSchemaTypes.SchemaBuilder<SchemaTypes>)(
      context,
    );
  }

  return builder.options.prisma.client;
}

export function getDMMF<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): DMMF['datamodel'] | RuntimeDataModel {
  if ('dmmf' in builder.options.prisma && builder.options.prisma.dmmf) {
    return (builder.options.prisma.dmmf as DMMF).datamodel;
  }

  const client = builder.options.prisma.client as unknown as {
    _baseDmmf?: DMMF;
    _dmmf: DMMF;
    _runtimeDataModel: RuntimeDataModel;
  };

  return client._runtimeDataModel ?? client._baseDmmf?.datamodel ?? client._dmmf.datamodel;
}
