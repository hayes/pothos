## Design overview

This is a high level overview of some of the internal concepts used in GiraphQL, and is not critical
to noraml ussage of GiraphQL in an application.

## Type System

The type system that powers most of the GiraphQL typecheckinig has 2 compoents. The first is the
[TypeInfo](/api-schema-builder#typeinfo) type param passed into the SchemaBuilder. This allows a
shared set of types to be reused throught the schema, and is responsible for providing type
information for shared types like the [Context](/guide-context) object, and any Object, Interface,
or Scalar types that you want to reference by name (as a string). Having all type information in a
single object can be convenient at times, but with large schemas, can become unweildy.

To support a number of additional use cases, including Unions and Enums, large schemas, and plugins
that use extract type information from other sources (eg the Prisma, or the simple-objects plugin),
GiraphQL has another way of passing around type information. This system is based in `Ref` objects
that contain the type information for the type the represt. Every builder method for creating a type
or a field returns a `Ref` object.

Using Ref objects allows us to separate the type information from the implementation, and allows for
a more modular design.

## Plugins

### Philosophy

GiraphQL aims to be extensible in a way that makes features from plugins feel like part of the core
experience. To acheive this, every options object used in GiraphQL can be extended with custom
properties. You may notice that there are places throughout the documentation where there are empty
options objects passed into functions. While this may seem inconvenient at first glance, the reason
behind is that it should be easy for pluginis to add new required options, and having optional
options objects would break that goal.

Implementing plugins for GiraphQL is currently not well documented, and requires a deep
understanding of how the internal types in GiraphQL function.

### Implementation

There are 3 parts to the GiraphQL plugin API.

1. The global `GiraphQLSchemaTypes` namespace.
2. The `BasePlugin` class
3. The `BaseFieldWrapper` class

#### GiraphQLSchemaTypes

`GiraphQLSchemaTypes` is a global typescript namespace that contains interfaces for all the object
types used by the GiraphQL, as well as types describing the core builder and field builder classes.
By putting these things in a shared global namespace, plugins can freely extend these types and take
advantage of all the same generics. This enables things like adding authorization check function
into field options, and allowiing those check functions to correctly infer the parent, and args for
the field.

#### BasePlugin

the `BasePlugin` class describes the hooks that are available for plugins, and enables plugins to
hook into the configuration of types and fields.

#### BaseFieldWrapper

The `BaseFieldWrapper` class provides functionality for wrapping fields with additional runtime
logic. There are a lot of use cases for wrapping fields, and when too many things need to wrap
fields to add their own logic, things can get complicated, and there are a lot of complex edge cases
to consider. The BaseFieldWrapper simplifiies to process of hooking into the execution lifecycle of
fields, allowing for running code before the field executes, after a field resolves, when the
concrete type of a returned object/interface/union is determined, as well as a way to pass
information down through the tree as a request is resolved.

### Field wrapping
