import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf, it } from 'vitest';
import PrismaPlugin, {
  type PrismaModelTypes,
  type PrismaTypesFromClient,
  type prismaModelName,
} from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

type PrismaTypes = PrismaTypesFromClient<typeof prisma>;

const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [RelayPlugin, PrismaPlugin],
  relay: {},
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

type Types = typeof builder.$inferSchemaTypes;
type UserModel = PrismaModelTypes & PrismaTypes['User'];
type UserShape = PrismaTypes['User']['Shape'];
type FieldBuilder<
  Model extends PrismaModelTypes,
  Shape extends object,
> = PothosSchemaTypes.PrismaObjectFieldBuilder<Types, Model, Shape>;

const User = builder.prismaObject('User', {
  fields: (t) => ({ id: t.exposeID('id') }),
});

const UserEmail = builder.prismaObject('User', {
  variant: 'UserEmail',
  select: { id: true, email: true },
  fields: (t) => ({ email: t.exposeString('email') }),
});

const UserNode = builder.prismaNode('User', {
  variant: 'UserNode',
  id: { field: 'id' },
  select: { id: true, name: true },
  fields: (t) => ({ name: t.exposeString('name', { nullable: true }) }),
});

const Named = builder.prismaInterface('User', {
  variant: 'Named',
  select: { id: true, name: true },
  fields: (t) => ({ name: t.exposeString('name', { nullable: true }) }),
});

type ByName = UserShape & { [prismaModelName]?: 'User' };
type EmailShape = { id: number; email: string } & { [prismaModelName]?: 'User' };
type NameShape = { id: number; name: string | null } & { [prismaModelName]?: 'User' };

it('types `t` and the parent of fields added by model name', () => {
  builder.prismaObjectField('User', 'a', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, ByName>>();
    return t.string({
      resolve: (user) => {
        expectTypeOf(user).toEqualTypeOf<ByName>();
        return user.email;
      },
    });
  });
  builder.prismaObjectFields('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, ByName>>();
    return {};
  });
  builder.prismaInterfaceField('User', 'a', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, ByName>>();
    return t.exposeString('email');
  });
  builder.prismaInterfaceFields('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, ByName>>();
    return {};
  });
});

it('types `t` and the parent of fields added by ref with the ref`s shape', () => {
  builder.prismaObjectField(User, 'a', (t) => {
    expectTypeOf(t).toEqualTypeOf<
      FieldBuilder<UserModel, UserShape & { [prismaModelName]?: 'User' }>
    >();
    return t.exposeString('email');
  });
  builder.prismaObjectField(UserEmail, 'b', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, EmailShape>>();
    return t.string({
      resolve: (user) => {
        expectTypeOf(user).toEqualTypeOf<EmailShape>();
        return user.email;
      },
    });
  });
  builder.prismaObjectFields(UserNode, (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, NameShape>>();
    return {};
  });
  builder.prismaInterfaceField(Named, 'c', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, NameShape>>();
    return t.string({ nullable: true, resolve: (user) => user.name });
  });
  builder.prismaInterfaceFields(Named, (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, NameShape>>();
    return {};
  });
});

it('accepts explicit type arguments', () => {
  builder.prismaObjectField<'User'>('User', 'd', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, ByName>>();
    return t.exposeString('email');
  });
  builder.prismaObjectFields<'User', UserModel>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, ByName>>();
    return {};
  });
  builder.prismaObjectFields<typeof UserEmail>(UserEmail, (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, EmailShape>>();
    return {};
  });
  builder.prismaInterfaceField<'User', UserModel, ByName>('User', 'e', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserModel, ByName>>();
    return t.exposeString('email');
  });
});
