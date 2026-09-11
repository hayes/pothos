// #region refs
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

const MyInput = builder.inputType('MyInput', {
  fields: (t) => ({
    id: t.id({ required: true }),
    name: t.string({ required: true }),
  }),
});

// { id: string; name: string; }
type MyInputShape = typeof MyInput.$inferInput;

const UserRef = builder.objectRef<{ id: string; name: string }>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});
type UserType = typeof UserRef.$inferType;

// #endregion refs

// #region object-helper
import type { FieldMap } from '@pothos/core';

type BuilderTypes = typeof builder.$inferSchemaTypes;

function createObjectWithId<T extends { id: string }>(
  name: string,
  fields: (t: PothosSchemaTypes.ObjectFieldBuilder<BuilderTypes, T>) => FieldMap,
) {
  const ref = builder.objectRef<T>(name);

  ref.implement({
    fields: (t) => ({
      ...fields(t),
      id: t.id({
        resolve: (parent) => parent.id,
        nullable: false,
      }),
    }),
  });

  return ref;
}

const UserWithId = createObjectWithId<{
  id: string;
  name: string;
}>('UserWithId', (t) => ({
  name: t.exposeString('name'),
}));

// #endregion object-helper

// #region pagination
import type { SchemaTypes } from '@pothos/core';

function createPaginationArgs<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  return builder.args((t) => ({
    limit: t.int(),
    offset: t.int(),
  }));
}

const users: UserType[] = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
];

function toUser(input: MyInputShape): UserType {
  return { id: input.id, name: input.name };
}

builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: UserRef,
      args: { input: t.arg({ type: MyInput, required: true }) },
      resolve: (_parent, { input }) => toUser(input),
    }),
  }),
});

builder.queryField('getUsers', (t) =>
  t.field({
    type: [UserWithId],
    args: {
      ...createPaginationArgs(builder),
    },
    resolve: (_parent, { limit, offset }) =>
      users.slice(offset ?? 0, (offset ?? 0) + (limit ?? users.length)),
  }),
);
// #endregion pagination

export const schema = builder.toSchema();
