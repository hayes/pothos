import SchemaBuilder from '@pothos/core';
import { PothosSchemaError } from '@pothos/core';
import PrismaPlugin from '../src';

describe('datamodel validation', () => {
  it('should throw error when uniqueIndexes is missing from model', () => {
    // Create a mock client with incomplete datamodel (simulating Prisma v7 without generated types)
    const mockClient = {
      $connect: () => Promise.resolve(),
      _runtimeDataModel: {
        models: {
          User: {
            fields: [
              {
                name: 'id',
                type: 'Int',
                kind: 'scalar',
                isRequired: true,
                isList: false,
                hasDefaultValue: true,
                isUnique: false,
                isId: true,
              },
            ],
            primaryKey: null,
            // Missing uniqueIndexes property to simulate incomplete datamodel
          },
        },
      },
    };

    const builder = new SchemaBuilder<{
      PrismaTypes: Record<string, unknown>;
    }>({
      plugins: [PrismaPlugin],
      prisma: {
        client: mockClient as any,
      },
    });

    // Attempting to create a prismaObject should throw an error
    expect(() => {
      builder.prismaObject('User', {
        fields: (t) => ({
          id: t.exposeID('id'),
        }),
      });
    }).toThrow(PothosSchemaError);

    expect(() => {
      builder.prismaObject('User', {
        fields: (t) => ({
          id: t.exposeID('id'),
        }),
      });
    }).toThrow(/missing required datamodel information/i);
  });

  it('should work when uniqueIndexes is present in model', () => {
    // Create a mock client with complete datamodel
    const mockClient = {
      $connect: () => Promise.resolve(),
      _runtimeDataModel: {
        models: {
          User: {
            fields: [
              {
                name: 'id',
                type: 'Int',
                kind: 'scalar',
                isRequired: true,
                isList: false,
                hasDefaultValue: true,
                isUnique: false,
                isId: true,
              },
            ],
            primaryKey: null,
            uniqueIndexes: [], // Present but empty is valid
          },
        },
      },
    };

    const builder = new SchemaBuilder<{
      PrismaTypes: Record<string, unknown>;
    }>({
      plugins: [PrismaPlugin],
      prisma: {
        client: mockClient as any,
      },
    });

    // This should not throw
    expect(() => {
      builder.prismaObject('User', {
        fields: (t) => ({
          id: t.exposeID('id'),
        }),
      });
    }).not.toThrow();
  });
});
