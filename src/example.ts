import SchemaBuilder, { ID, Int } from '.';
import InputType from './input';

const builder = new SchemaBuilder<
  // Model shapes
  {
    ID: bigint;
    Int: number;
    Float: number;
    String: string;
    Boolean: boolean;
    User: { firstName: string; lastName: string };
    Article: { title: string; body: string };
    Countable: { count: number };
    Shaveable: { shaved: boolean };
    Sheep: { name: string; count: number; shaved: boolean };
  },
  // Context shape
  { userID: number }
>();

// Create input types
const Example = InputType.createInputType('Example', {
  // arrow function syntax explained below
  id: () => ID,
});

// When creating input types with circular references
// shape needs to be defined explicitly but is still checked by the type checker
type ExampleShape = {
  id: bigint;
  example: {
    id: bigint;
  };
  more: ExampleShape;
};

const Example2: InputType<ExampleShape> = InputType.createInputType('Example', {
  example: () => Example,
  id: {
    required: false,
    type: () => ID,
  },
  // We use arrow function syntax to allow this type of circular reference
  more: () => Example2,
});

// Union type
const SearchResult = builder.createUnionType('SearchResult', {
  members: ['User', 'Article'],
  resolveType: parent => {
    return Object.prototype.hasOwnProperty.call(parent, 'firstName') ? 'User' : 'Article';
  },
});

// Creating an ObjectType and its resolvers
const User = builder.createObjectType('User', {
  shape: {
    // add a scalar field
    id: t => t.id({ resolver: () => 5n }),
    // parent is inferred from model shapes defined in builder
    displayName: t =>
      t.string({
        resolver: ({ firstName, lastName }) => `${firstName} ${lastName.slice(0, 1)}.`,
      }),
    // Detects if resolver can be omitted
    firstName: t => t.string({}),
    lastName: t => t.string({}),
    // Non scalar fields:
    firstBornChild: t =>
      t.field({
        type: 'User',
        resolver: () => ({
          firstName: 'child',
          lastName: '1',
        }),
      }),
    // creating a resolver with args
    partialName: t =>
      t.string({
        args: {
          // args use arrow function syntax for consistency with input type syntax
          example: () => Example,
          firstN: () => Int,
        },
        resolver: (parent, args) => {
          return parent.firstName.slice(0, args.firstN) + args.example.id;
        },
      }),
    // creating a resolver with args that use recursive types
    recursiveArgs: t =>
      t.id({
        args: {
          example2: () => Example2,
          firstN: () => Int,
        },
        resolver: (parent, args) => {
          return args.example2.more.more.more.example.id;
        },
      }),
    // add directives
    privateField: t =>
      t.string({
        // map of directives -> directive args
        directives: { privateData: [] },
        resolver: (parent, args) => {
          return 'private stuff';
        },
      }),
    // Using a union type
    related: t =>
      t.field({
        resolver: parent => {
          return {
            body: 'stuff',
            title: 'hi',
          };
        },
        // reference implementation so we can automatically pull types for all member types
        type: () => SearchResult,
      }),
    // Lists
    friends: t =>
      t.field({
        resolver: parent => {
          return [parent];
        },
        type: ['User'],
      }),
    // list helpers
    stuff: t =>
      t.stringList({
        resolver() {
          return ['soup', 'cats'];
        },
      }),
    // optional fields
    optional: t =>
      t.string({
        required: false,
        resolver: () => null,
      }),
    // list and optional args
    list: t =>
      t.idList({
        args: {
          ids: {
            required: false,
            type: () => [ID],
          },
        },
        required: false,
        resolver: (parent, args) => args.ids,
      }),
  },
});

// TODO
// Build fields independently
// const UserFields = builder
//   .fieldBuilder('User')
//   .string('firstName', {})
//   .string('lastName', {})
//   .string('displayName', {
//     resolver: ({ firstName, lastName }) => `${firstName} ${lastName.slice(0, 1)}.`,
//   });

// Build using fields defined outside the class
// builder.createObjectType('User', {
//   shape: UserFields,
// });

const Countable = builder.createInterfaceType('Countable', {
  shape: {
    count: t => t.int({}),
  },
});

const Shaveable = builder.createInterfaceType('Shaveable', {
  shape: {
    id: t =>
      t.id({
        resolver: () => 5n,
      }),
    shaved: t => t.boolean({}),
  },
});

const Sheep = builder.createObjectType('Sheep', {
  check: () => true,
  implements: [Shaveable, Countable],
  shape: t =>
    t
      .string('color', { args: { id: () => ID }, resolver: () => 'black' })
      // Errors when adding type already defined in interface
      // .id('shaved', {
      //   resolver: () => 4n,
      // })
      // .id('id', { resolver: () => 5n }),
      .id('id2', { resolver: () => 5n })
      // modify previous args (from interfaces)
      .modify('shaved', { resolver: () => true })
      .modify('color', {
        description: 'shaved sheep?',
        resolver: (parent, args) => (args.id === 1n ? 'red' : 'blue'),
      }),
});

// Enums
const Stuff = builder.createEnumType('stuff', {
  values: ['Beats', 'Bears', 'BattlestarGalactica'] as const,
});

console.log(User, Sheep, Stuff);
