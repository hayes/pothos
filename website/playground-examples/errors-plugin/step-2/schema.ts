import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';

// Step 2: Custom error classes + multiple error types in a union.
//
// Step 1 used a single Error type. Here we add two domain-specific
// classes (NotFoundError and ValidationError) and expose both on the
// same field. The errors plugin generates a union
// (`QueryUserResult = User | NotFoundError | ValidationError`) so
// clients can pattern-match on `__typename`.

class NotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`No user found with id "${id}"`);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin],
  errors: {
    defaultTypes: [],
  },
});

builder.objectType(NotFoundError, {
  name: 'NotFoundError',
  fields: (t) => ({
    message: t.exposeString('message'),
    id: t.exposeString('id'),
  }),
});

builder.objectType(ValidationError, {
  name: 'ValidationError',
  fields: (t) => ({
    message: t.exposeString('message'),
    field: t.exposeString('field'),
  }),
});

interface User {
  id: string;
  name: string;
}

const USERS: User[] = [
  { id: '1', name: 'Ada Lovelace' },
  { id: '2', name: 'Grace Hopper' },
];

const UserRef = builder.objectRef<User>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: UserRef,
      errors: {
        types: [NotFoundError, ValidationError],
      },
      args: {
        id: t.arg.string({ required: true }),
      },
      resolve: (_parent, { id }) => {
        if (!/^\d+$/.test(id)) {
          throw new ValidationError('id must be numeric', 'id');
        }
        const user = USERS.find((u) => u.id === id);
        if (!user) {
          throw new NotFoundError(id);
        }
        return user;
      },
    }),
  }),
});

export const schema = builder.toSchema();
