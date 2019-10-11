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
  shape: t =>
    t
      // add a scalar field
      .id('id', { resolver: () => 5n })
      // parent is inferred from model shapes defined in builder
      .string('displayName', {
        resolver: ({ firstName, lastName }) => `${firstName} ${lastName.slice(0, 1)}.`,
      })
      // Detects if resolver can be omitted
      .string('firstName', {})
      .string('lastName', {})
      // Non scalar fields:
      .field('firstBornChild', {
        type: 'User',
        resolver: () => ({
          firstName: 'child',
          lastName: '1',
        }),
      })
      // creating a resolver with args
      .string('partialName', {
        args: {
          // args use arrow function syntax for consistency with input type syntax
          example: () => Example,
          firstN: () => Int,
        },
        resolver: (parent, args) => {
          return parent.firstName.slice(0, args.firstN) + args.example.id;
        },
      })
      // creating a resolver with args that use recursive types
      .id('partialName', {
        args: {
          example2: () => Example2,
          firstN: () => Int,
        },
        resolver: (parent, args) => {
          return args.example2.more.more.more.example.id;
        },
      })
      // add directives
      .string('privateField', {
        // map of directives -> directive args
        directives: { privateData: [] },
        resolver: (parent, args) => {
          return 'private stuff';
        },
      })
      // Using a union type
      .field('related', {
        resolver: parent => {
          return {
            body: 'stuff',
            title: 'hi',
          };
        },
        // reference implementation so we can automatically pull types for all member types
        type: () => SearchResult,
      })
      // Lists
      .field('friends', {
        resolver: parent => {
          return [parent];
        },
        type: ['User'],
      })
      // list helpers
      .stringList('stuff', {
        resolver() {
          return ['soup', 'cats'];
        },
      })
      // optional fields
      .string('optional', {
        required: false,
        resolver: () => null,
      })
      // list and optional args
      .idList('list', {
        args: {
          ids: {
            required: false,
            type: () => [ID],
          },
        },
        required: false,
        resolver: (parent, args) => args.ids,
      }),
});

// Build fields independently
const UserFields = builder
  .fieldBuilder('User')
  .string('firstName', {})
  .string('lastName', {})
  .string('displayName', {
    resolver: ({ firstName, lastName }) => `${firstName} ${lastName.slice(0, 1)}.`,
  });

// Build using fields defined outside the class
builder.createObjectType('User', {
  shape: UserFields,
});

// won't be a real method, but shows that built fields have real shape
UserFields.addValidator(user => typeof user.displayName === 'string');

// Compile to usable graphql-js schema type
User.build();
