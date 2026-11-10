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

// An explicit `Model` other than the name's own keeps `Model['Shape']` as the parent.
type AnyFieldBuilder = FieldBuilder<PrismaModelTypes, PrismaModelTypes['Shape']>;
type PostOrComment = PrismaModelTypes & (PrismaTypes['Post'] | PrismaTypes['Comment']);
type IdModel = PrismaModelTypes & { Shape: { id: number } };
type Named<Model extends PrismaModelTypes, Name> = Model['Shape'] & { [prismaModelName]?: Name };

const typename = (t: AnyFieldBuilder) => t.string({ resolve: () => 'x' });
const typenameFields = (t: AnyFieldBuilder) => ({ kind: t.string({ resolve: () => 'x' }) });
const createdAt = (t: FieldBuilder<PostOrComment, PostOrComment['Shape']>) =>
  t.string({ resolve: (row) => row.createdAt.toISOString() });
const createdAtFields = (t: FieldBuilder<PostOrComment, PostOrComment['Shape']>) => ({
  createdAt: createdAt(t),
});

it('accepts callbacks written against a wider model', () => {
  builder.prismaObjectField<'User', PrismaModelTypes>('User', 'w1', typename);
  builder.prismaObjectFields<'User', PrismaModelTypes>('User', typenameFields);
  builder.prismaInterfaceField<'User', PrismaModelTypes>('User', 'w1', typename);
  builder.prismaInterfaceFields<'User', PrismaModelTypes>('User', typenameFields);

  for (const name of ['User', 'Post'] as const) {
    builder.prismaObjectField<typeof name, PrismaModelTypes>(name, 'w2', typename);
    builder.prismaObjectFields<typeof name, PrismaModelTypes>(name, typenameFields);
    builder.prismaInterfaceField<typeof name, PrismaModelTypes>(name, 'w2', typename);
    builder.prismaInterfaceFields<typeof name, PrismaModelTypes>(name, typenameFields);
  }

  builder.prismaObjectField<'Post', PostOrComment>('Post', 'w3', createdAt);
  builder.prismaObjectFields<'Post', PostOrComment>('Post', createdAtFields);
  builder.prismaInterfaceField<'Post', PostOrComment>('Post', 'w3', createdAt);
  builder.prismaInterfaceFields<'Post', PostOrComment>('Post', createdAtFields);
});

it('types `t` and the parent with an explicit wider model', () => {
  builder.prismaObjectField<'User', PrismaModelTypes>('User', 'w4', (t) => {
    expectTypeOf(t).toEqualTypeOf<
      FieldBuilder<PrismaModelTypes, Named<PrismaModelTypes, 'User'>>
    >();
    return t.string({ resolve: () => 'x' });
  });
  builder.prismaObjectFields<'User', PrismaModelTypes>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<
      FieldBuilder<PrismaModelTypes, Named<PrismaModelTypes, 'User'>>
    >();
    return {};
  });
  builder.prismaInterfaceField<'Post', PostOrComment>('Post', 'w4', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<PostOrComment, Named<PostOrComment, 'Post'>>>();
    return t.string({ resolve: (row) => row.createdAt.toISOString() });
  });
  builder.prismaInterfaceFields<'Post', PostOrComment>('Post', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<PostOrComment, Named<PostOrComment, 'Post'>>>();
    return {};
  });
  builder.prismaObjectFields<'User' | 'Post', IdModel>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<
      FieldBuilder<IdModel, Named<IdModel, 'User'> | Named<IdModel, 'Post'>>
    >();
    return {
      k: t.int({
        resolve: (parent) => {
          const row: typeof parent = { id: 1 };
          return row.id;
        },
      }),
    };
  });
  builder.prismaInterfaceField<'User' | 'Post', IdModel>('User', 'k', (t) => {
    expectTypeOf(t).toEqualTypeOf<
      FieldBuilder<IdModel, Named<IdModel, 'User'> | Named<IdModel, 'Post'>>
    >();
    return t.int({ resolve: (parent) => parent.id });
  });
});

it('accepts a name whose type is a union of names', () => {
  type UserOrPost =
    | Named<PrismaModelTypes & (PrismaTypes['User'] | PrismaTypes['Post']), 'User'>
    | Named<PrismaModelTypes & (PrismaTypes['User'] | PrismaTypes['Post']), 'Post'>;

  for (const name of ['User', 'Post'] as const) {
    builder.prismaObjectField(name, 'u1', (t) =>
      t.int({
        resolve: (parent) => {
          const row: UserOrPost = parent;
          return row.id;
        },
      }),
    );
    builder.prismaObjectFields(name, (t) => ({
      u1: t.int({ resolve: (parent) => parent.id }),
    }));
    builder.prismaInterfaceField(name, 'u1', (t) => t.exposeInt('id'));
    builder.prismaInterfaceFields(name, (t) => ({ u1: t.exposeID('id') }));
    builder.prismaObjectField(name, 'u2', typename);
    builder.prismaObjectFields(name, typenameFields);
  }
});

// biome-ignore lint/suspicious/noExplicitAny: an `any` model is one of the explicit models checked
type AnyModel = any;
type AnyModelFieldBuilder = FieldBuilder<AnyModel, AnyModel>;

it('keeps the shape of an explicit model that only differs from the default in loose parts', () => {
  type UserWithNick = Omit<PrismaTypes['User'], 'Shape'> & {
    Shape: UserShape & { nick?: string };
  };
  type UserWithExtra = PrismaTypes['User'] & { Shape: { extra?: string } };
  type UserWithAnyShape = Omit<PrismaTypes['User'], 'Shape'> & { Shape: AnyModel };

  builder.prismaObjectFields<'User', AnyModel>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<AnyModelFieldBuilder>();
    return {
      x1: t.string({
        resolve: (user) => {
          expectTypeOf(user).toBeAny();
          return String(user.anything);
        },
      }),
    };
  });
  builder.prismaObjectField<'User', AnyModel>('User', 'x1', (t) => {
    expectTypeOf(t).toEqualTypeOf<AnyModelFieldBuilder>();
    return t.string({ resolve: (user) => String(user.anything) });
  });
  builder.prismaInterfaceFields<'User', AnyModel>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<AnyModelFieldBuilder>();
    return { x1: t.string({ resolve: (user) => String(user.anything) }) };
  });
  builder.prismaInterfaceField<'User', AnyModel>('User', 'x1', (t) => {
    expectTypeOf(t).toEqualTypeOf<AnyModelFieldBuilder>();
    return t.string({ resolve: (user) => String(user.anything) });
  });

  builder.prismaObjectFields<'User', UserWithNick>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithNick, Named<UserWithNick, 'User'>>>();
    return {
      x2: t.string({
        nullable: true,
        resolve: (user) => {
          expectTypeOf(user).toEqualTypeOf<Named<UserWithNick, 'User'>>();
          return user.nick;
        },
      }),
    };
  });
  builder.prismaObjectField<'User', UserWithNick>('User', 'x2', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithNick, Named<UserWithNick, 'User'>>>();
    return t.string({ nullable: true, resolve: (user) => user.nick });
  });
  builder.prismaInterfaceFields<'User', UserWithNick>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithNick, Named<UserWithNick, 'User'>>>();
    return { x2: t.string({ nullable: true, resolve: (user) => user.nick }) };
  });
  builder.prismaInterfaceField<'User', UserWithNick>('User', 'x2', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithNick, Named<UserWithNick, 'User'>>>();
    return t.string({ nullable: true, resolve: (user) => user.nick });
  });

  builder.prismaObjectFields<'User', UserWithExtra>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithExtra, Named<UserWithExtra, 'User'>>>();
    return {
      x3: t.string({
        nullable: true,
        resolve: (user) => {
          expectTypeOf(user).toEqualTypeOf<Named<UserWithExtra, 'User'>>();
          return user.extra;
        },
      }),
    };
  });
  builder.prismaObjectField<'User', UserWithExtra>('User', 'x3', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithExtra, Named<UserWithExtra, 'User'>>>();
    return t.string({ nullable: true, resolve: (user) => user.extra });
  });
  builder.prismaInterfaceFields<'User', UserWithExtra>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithExtra, Named<UserWithExtra, 'User'>>>();
    return { x3: t.string({ nullable: true, resolve: (user) => user.extra }) };
  });
  builder.prismaInterfaceField<'User', UserWithExtra>('User', 'x3', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithExtra, Named<UserWithExtra, 'User'>>>();
    return t.string({ nullable: true, resolve: (user) => user.extra });
  });

  builder.prismaObjectFields<'User', UserWithAnyShape>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithAnyShape, AnyModel>>();
    return {
      x4: t.string({
        resolve: (user) => {
          expectTypeOf(user).toBeAny();
          return String(user.anything);
        },
      }),
    };
  });
  builder.prismaObjectField<'User', UserWithAnyShape>('User', 'x4', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithAnyShape, AnyModel>>();
    return t.string({ resolve: (user) => String(user.anything) });
  });
  builder.prismaInterfaceFields<'User', UserWithAnyShape>('User', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithAnyShape, AnyModel>>();
    return { x4: t.string({ resolve: (user) => String(user.anything) }) };
  });
  builder.prismaInterfaceField<'User', UserWithAnyShape>('User', 'x4', (t) => {
    expectTypeOf(t).toEqualTypeOf<FieldBuilder<UserWithAnyShape, AnyModel>>();
    return t.string({ resolve: (user) => String(user.anything) });
  });
});

it('keeps the shape of a generic model given for one name', () => {
  function addId<Model extends PrismaModelTypes & { Shape: { id: number } }>(
    fields: (t: FieldBuilder<Model, Named<Model, 'User'>>) => {},
  ) {
    builder.prismaObjectFields<'User', Model>('User', (t) => {
      expectTypeOf(t).toEqualTypeOf<FieldBuilder<Model, Named<Model, 'User'>>>();
      return {
        g1: t.int({
          resolve: (user) => {
            const named: Named<Model, 'User'> = user;
            const parent: typeof user = named;
            return parent.id;
          },
        }),
      };
    });
    builder.prismaObjectFields<'User', Model>('User', fields);
    builder.prismaInterfaceFields<'User', Model>('User', fields);
    builder.prismaObjectField<'User', Model>('User', 'g1', (t) => {
      expectTypeOf(t).toEqualTypeOf<FieldBuilder<Model, Named<Model, 'User'>>>();
      return t.int({ resolve: (user) => user.id });
    });
    builder.prismaInterfaceField<'User', Model>('User', 'g1', (t) => {
      expectTypeOf(t).toEqualTypeOf<FieldBuilder<Model, Named<Model, 'User'>>>();
      return t.int({ resolve: (user) => user.id });
    });
  }

  addId<UserModel>(() => ({}));
});

// Differs from main, accepted: with several names and a generic model, the model's shape can't be
// assigned back to the parent.
it('reads a generic model given for several names', () => {
  function addId<Model extends PrismaModelTypes & { Shape: { id: number } }>(
    named: Named<Model, 'User'>,
  ) {
    builder.prismaObjectFields<'User' | 'Post', Model>('User', (t) => ({
      g2: t.int({
        resolve: (parent) => {
          const shape: Model['Shape'] = parent;
          // @ts-expect-error
          const back: typeof parent = named;

          return parent.id + shape.id + back.id;
        },
      }),
    }));
  }

  addId<UserModel>({ id: 1, email: '', name: null });
});
