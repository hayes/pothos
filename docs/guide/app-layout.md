---
name: App Layout
menu: Guide
---

# App layout

GiraphQL tries not to be opinionated about how you structure your code, and provides multiple ways of doing many things. This short guide are a few conventions I use, as a starting place for anyone who is just looking for a decent setup that should just work. Everything suggested here is just a recommendation, and is completely optional.

## Files

Here are a few files I create in almost every GiraphQL schema I have built:

* `src/server.ts`: Setup and run your server \(probably apollo, as described in other guides\)
* `src/builder.ts`: Setup for your schema builder. Does not contain any definitions for types in

  your schema

* `src/schema.ts` or `src/schema/index.ts`: Imports all the files that define part of your schema,

  but does not define types itself. Exports `builder.toSchema({})`

* `src/types.ts`: Define shared types used across your schema including a type for you context

  object. This should be imported when creating your builder, and may be used by many other files.

* `src/schema/*.ts`: Actual definitions for your schema types.

## Plugins

Which plugins you use is completely up to you. For my own projects, I will use the `simple-objects`, `scope-auth`, and `mocks` plugins in every project, and some of the other plugins as needed.

`mocks` and `scope-auth` are fairly self explanatory. The `simple-objects` plugin can make building out a graph much quicker, because you don't have to have explicit types or models for every object in your graph. I frequently find that I just want to add on object of a specific shape, and then let the parent field figure out how to return an object of the right shape.

## Backing models

GiraphQL gives you a lot of control over how you define the types that your schema and resolver use. Which can make figuring out the right approach can be confusing at first. In my projects, I try to avoid using the `SchemaTypes` approach for defining backing models. Instead, I tend to use model classes for defining most of the important objects in my graph, and fall back to using either the simple-objects plugin or `builder.objectRef<Shape>(name).implement({...})` when it does not make sense to define a class for my data.

## Co-locating queries

In bigger graphs, having all your queries/entry points defined in once place can become hard to manage. Instead, I prefer to define queries along side the types they return. For example, queries for a `User` type would be defined in the same file that contains the definition for the `User` type, rather than in a central `queries.ts` file \(using `builder.queryField`\).

