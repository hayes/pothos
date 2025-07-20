# Context
should we find a way to type `context()` in plans?

Are there any problems with calling `context()` once, and passing it into every plan method?

# Get

* `get` returns undefined in some definition?
* `Step.get` return `any`

# interfaces

planType isn't typesafe for loading concrete types

# Data loading?
does `planType` work on non-abstract types? and do you still need a $typename plan?

Trying to figure out if this makes for non-polymorphic types:
```ts
{
  Query: {
    plans: {
      user: (_, { $id } ) => $id
    }
  },
  User: {
    planType($id) {
        const $record = loadOne($id, batchGetUserById);
        const $__typename = constant('User');
        return {
          $__typename,
          planForType() {
            return $record;
          },
        };
    }
  }
}
```

In pothos, there is usually 1 ts type associated with each GraphQL type (defining both what resolvers need to return, and what resolvers use as the source/parent argument for a given type), but this data can be broken out so that resolvers can be typed to expect a different return value (eg an ID) than wheat is used for the parent arg (the loaded data).  The same concept would apply to plans


For interfaces in pothos, I think they way to go would be something like:

```ts
// define types for both the parent and loaded data
const Character = builder.interfaceWithPlan<number, CharacterData>({
  name: 'Character',
  planType: ($id) {
    const $record = loadOne($id, batchGetUserById);
    const $__typename = constant('User');
    return {
      $__typename,
      planForType() {
        return $record;
      },
    };
  }
})

Character.implement({
  fields: (t) => ({
    // uses types from loaded in the implementation
    name: t.exposeString('name')
  })
})
```



## Resolve info

> resolveType and isTypeOf, if specified, must return the GraphQL type name as a string (rather than returning the object type itself) and their version of GraphQLResolveInfo is even more cut down (but you shouldn't be using that anyway?)

Pothos uses async resolveInfo/isTypeOf for auth (sorry!)

Should the pothos plugin use `Omit<GraphQLResolveInfo, 'path'>` instead of omitting info entirely?


## Limit on batched query?

The grafast homepage doc has an example `RecordsByColumnStep` with a `setFirst` argument.

This will cause potentially unexpected behavior if used carelessly, and there is probably an opportunity to talk about implications of batching in the docs.


## Authorization

Where should authorization checks happen? Since plans can execute before resolving data for specific fields, you may not be able to prevent loading if you prevent returning data.  Maybe loading should be deferred (intentionally break optimizations like ioequivalance )

## Validation

Is there a way to provide plans for validation on input?

Can you inject plans that do authorization into fields without breaking relations to ancestors?

## Input transforms

Can you transform inputs?  (eg, The relay plugin expects Global IDs to be decoded, which is done though a resolver wrapper in pothos)

## Fan-in

What does fan-in practically mean when you have a branching query?

```graphql
query {
  node {
    ... on User {
      name
      pets {
        name
      }
    }
    ... on Organization {
      serviceAnimals {
        name
        owner {
          name
        }
      }
    }
  }
}
```
If Animals are fanned back in, how does it handle different sub-selections?

If Deduplicate happens before Optimize, can service animals ask an ancestor to include owner during optimization, and if so, does the deduplicated step then over-fetch for the pets, or can it break out the step again?



## Polymorphic outdate doc
In Plan Resolvers

> In the case of a field that has a polymorphic type, the step that is returned must be a polymorphic-capable plan

## Node

> Returns a polymorphic-capable step


## assertStep docs

> When defined via makeGrafastSchema we cannot call the property assertStep directly as it might conflict with a field name, so instead we use assertStep, knowing that GraphQL forbids fields to start with __

The following example doesn't actually do what this says

## Plan and Resolver?

> A plan resolver can be used instead of, or in addition to, a traditional resolver.

How doe this work?
