import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';

const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin],
  errors: {
    // BaseError is merged into every field that opts into error handling.
    defaultTypes: [Error],
  },
});

interface ITeam {
  id: number;
  name: string;
}

const Teams = new Map<number, ITeam>([
  [1, { id: 1, name: 'Comet' }],
  [2, { id: 2, name: 'Aurora' }],
]);

// One interface every error type implements. Clients can always fall back
// to `... on Error { message }` and add narrower fragments when they care.
const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

// The catch-all error, registered in defaultTypes above.
builder.objectType(Error, {
  name: 'BaseError',
  interfaces: [ErrorInterface],
});

class NotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`No team with id ${id}`);
    this.name = 'NotFoundError';
  }
}

builder.objectType(NotFoundError, {
  name: 'NotFoundError',
  interfaces: [ErrorInterface],
  fields: (t) => ({
    id: t.exposeString('id'),
  }),
});

const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Only the default BaseError is handled here.
    firstTeam: t.field({
      type: Team,
      errors: {},
      resolve: () => {
        const team = Teams.get(1);
        if (!team) {
          throw new Error('roster is empty');
        }
        return team;
      },
    }),
    // Adds NotFoundError on top of the default BaseError.
    team: t.field({
      type: Team,
      errors: {
        types: [NotFoundError],
      },
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_parent, { id }) => {
        const team = Teams.get(Number(id));
        if (!team) {
          throw new NotFoundError(String(id));
        }
        return team;
      },
    }),
  }),
});

export const schema = builder.toSchema();
