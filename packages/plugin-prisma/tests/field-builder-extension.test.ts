import SchemaBuilder, { type SchemaTypes } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { afterAll, describe, expect, expectTypeOf, it } from 'vitest';
import PrismaPlugin, {
  ObjectFieldBuilder,
  type PrismaModelTypes,
  type PrismaTypesFromClient,
} from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

declare global {
  namespace PothosSchemaTypes {
    interface PrismaObjectFieldBuilder<
      Types extends SchemaTypes,
      Model extends PrismaModelTypes,
      Shape extends object = Model['Shape'],
    > {
      /** Added by another plugin to the `t` of prisma type fields. */
      testModelName(): Model['Name'];
    }
  }
}

ObjectFieldBuilder.prototype.testModelName = function testModelName(this: { model: string }) {
  return this.model;
};

function createBuilder() {
  return new SchemaBuilder<{ PrismaTypes: PrismaTypesFromClient<typeof prisma> }>({
    plugins: [RelayPlugin, PrismaPlugin],
    relay: {},
    prisma: { client: () => prisma, dmmf: getDatamodel() },
  });
}

describe('field builder extensions', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('calls methods merged onto the global field builder from every prisma type`s `t`', async () => {
    const builder = createBuilder();

    const Named = builder.prismaInterface('User', {
      variant: 'Named',
      select: { id: true },
      fields: (t) => {
        const model = t.testModelName();
        expectTypeOf(model).toEqualTypeOf<'User'>();
        return { interfaceModel: t.string({ resolve: () => model }) };
      },
    });

    const User = builder.prismaObject('User', {
      interfaces: [Named],
      select: { id: true },
      fields: (t) => {
        const model = t.testModelName();
        expectTypeOf(model).toEqualTypeOf<'User'>();
        return { objectModel: t.string({ resolve: () => model }) };
      },
    });

    const UserNode = builder.prismaNode('User', {
      variant: 'UserNode',
      id: { field: 'id' },
      fields: (t) => {
        const model = t.testModelName();
        expectTypeOf(model).toEqualTypeOf<'User'>();
        return { nodeModel: t.string({ resolve: () => model }) };
      },
    });

    builder.prismaObjectField(User, 'fieldModel', (t) =>
      t.string({ resolve: () => t.testModelName() }),
    );
    builder.prismaObjectFields('User', (t) => ({
      fieldsModel: t.string({ resolve: () => t.testModelName() }),
      node: t.variant(UserNode),
    }));
    builder.prismaInterfaceField(Named, 'interfaceFieldModel', (t) =>
      t.string({ resolve: () => t.testModelName() }),
    );

    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: User,
          resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: gql`
        query {
          user {
            interfaceModel
            objectModel
            fieldModel
            fieldsModel
            interfaceFieldModel
            node {
              nodeModel
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({
      data: {
        user: {
          interfaceModel: 'User',
          objectModel: 'User',
          fieldModel: 'User',
          fieldsModel: 'User',
          interfaceFieldModel: 'User',
          node: { nodeModel: 'User' },
        },
      },
    });
  });
});
