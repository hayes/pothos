---
description: >-
  This is a high level overview of some of the internal concepts used in GiraphQL, and is not
  critical to normal usage of GiraphQL in an application.
---

# Design

## Type System

The type system that powers most of the GiraphQL type checking has 2 components. The first is the
SchemaTypes type param passed into the SchemaBuilder. This allows a shared set of types to be reused
throughout the schema, and is responsible for providing type information for shared types like the
[Context](guide/context.md) object, and any Object, Interface, or Scalar types that you want to
reference by name \(as a string\). Having all type information in a single object can be convenient
at times, but with large schemas, can become unwieldy.

To support a number of additional use cases, including Unions and Enums, large schemas, and plugins
that use extract type information from other sources \(eg the Prisma, or the simple-objects
plugin\), GiraphQL has another way of passing around type information. This system is based in `Ref`
objects that contain the type information it represents. Every builder method for creating a type or
a field returns a `Ref` object.

Using Ref objects allows us to separate the type information from the implementation, and allows for
a more modular design.
