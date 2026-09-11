// #region setup
import SchemaBuilder from '@pothos/core';
import GrafastPlugin from '@pothos/plugin-grafast';
import { get, inhibitOnNull, lambda, loadOne, type Step } from 'grafast';

type RequestContext = { requestId: string };

declare global {
  namespace Grafast {
    // Define the Context type used by grafast
    interface Context extends RequestContext {}
  }
}

type BuilderTypes = {
  // This tells the builder to expect plans instead of resolvers
  InferredFieldOptionsKind: 'Grafast';
  Context: RequestContext;
};

const builder = new SchemaBuilder<BuilderTypes>({
  plugins: [GrafastPlugin],
});
// #endregion setup

// #region query
builder.queryType({
  fields: (t) => ({
    addTwoNumbers: t.int({
      args: {
        a: t.arg.int({ required: true }),
        b: t.arg.int({ required: true }),
      },
      plan: (_, { $a, $b }) => {
        return lambda([$a, $b], ([a, b]) => a + b);
      },
    }),
  }),
});
// #endregion query

// #region interface-type
interface AnimalData {
  id: string;
  kind: 'Dog' | 'Cat';
}

export const Animal = builder.interfaceRef<AnimalData>('Animal').withPlan({
  planType: ($record) => ({
    $__typename: get($record, 'kind'),
  }),
});

export const Dog = builder.objectRef<AnimalData>('Dog').implement({
  interfaces: [Animal],
});
export const Cat = builder.objectRef<AnimalData>('Cat').implement({
  interfaces: [Animal],
});

Animal.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

// #endregion interface-type

// #region interface-query
export const Animals = [
  {
    id: '1',
    kind: 'Dog',
  },
  {
    id: '2',
    kind: 'Cat',
  },
] satisfies AnimalData[];

function getAnimalsById(ids: readonly string[]): (AnimalData | null)[] {
  return ids.map((id) => Animals.find((entity) => entity.id === id) ?? null);
}

builder.queryFields((t) => ({
  animal: t.field({
    type: Animal,
    args: {
      id: t.arg.string({ required: true }),
    },
    plan: (_, $args) => loadOne($args.$id, getAnimalsById),
  }),
}));
// #endregion interface-query

// #region alien
interface AlienData {
  id: string;
  kind: 'Alien';
}

export const Alien = builder.objectRef<AlienData>('Alien').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

// #endregion alien

// #region union
function getEntitiesById(ids: readonly string[]): (AnimalData | AlienData | null)[] {
  const entities: (AnimalData | AlienData)[] = [...Animals, { id: '3', kind: 'Alien' }];
  return ids.map((id) => entities.find((entity) => entity.id === id) ?? null);
}

export const Entity = builder
  .unionType('Entity', {
    types: [Cat, Dog, Alien],
  })
  .withPlan({
    planType: (
      // Provide an explicit type so that the query field only needs to return the ID
      $specifier: Step<string>,
    ) => {
      const $record = inhibitOnNull(loadOne($specifier, getEntitiesById));
      return {
        $__typename: get($record, 'kind'),
        planForType: () => $record,
      };
    },
  });

builder.queryFields((t) => ({
  entity: t.field({
    type: Entity,
    args: {
      id: t.arg.string({ required: true }),
    },
    // Because our Entity plan loads the record, we can just return the ID here
    plan: (_, $args) => $args.$id,
  }),
}));
// #endregion union

export const schema = builder.toSchema();
