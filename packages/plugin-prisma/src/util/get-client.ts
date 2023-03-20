/* eslint-disable no-underscore-dangle */
import { createContextCache, SchemaTypes } from '@pothos/core';
import { PrismaClient } from '../types';

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

interface DMMF {
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

const prismaClientCache = createContextCache(
  <Types extends SchemaTypes>(builder: PothosSchemaTypes.SchemaBuilder<Types>) =>
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
    return prismaClientCache(builder)(context);
  }

  return builder.options.prisma.client;
}

export function getDMMF<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): DMMF {
  if ('dmmf' in builder.options.prisma && builder.options.prisma.dmmf) {
    return builder.options.prisma.dmmf as DMMF;
  }

  const client = builder.options.prisma.client as unknown as {
    _baseDmmf?: DMMF;
    _dmmf: DMMF;
  };

  return client._baseDmmf ?? client._dmmf;
}
