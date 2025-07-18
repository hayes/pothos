# Context
should we find a way to type `context()` in plans?


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


