# Schema builder

## Getting started

Becoming a super hero is a fairly straight forward process:

```typescript
import SchemaBuilder from './still-need-a-name'

type ContextShape = {}

const builder = new SchemaBuilder<{
  Input: {
    // optional place to define shapes for input types
    // or overwrite types of scalars in args
  };
  Output: {
    // backing models/shapes for objects and interfaces
    // can also overwrite the scalars return values in resolvers
    User: {
      first: string;
      last: string;
    };
  };
}, ContextShape>()

const User = builder.createObject('User', {
  shape: t => ({
    firstName: t.exoseString('first', {}),
    lastName: t.exoseString('first', {}),
    fullName: t.string({
      resolver: parent => `${parent.first} ${parent.last}`
    }),
  }),
})

const Query = builder.createObject('Query', () => {
  shape: t =>({
    user: t.field({
      type: 'User',
      resolve: () => { first: 'Leia', last: 'Organa' }
    })
  })
})

const schema = builder.toSchema([Query, User])
```

{% hint style="info" %}
 Super-powers are granted randomly so please submit an issue if you're not happy with yours.
{% endhint %}

Once you're strong enough, save the world:

```
// Ain't no code for that yet, sorry
echo 'You got to trust me on this, I saved the world'
```



