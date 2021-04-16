---
name: Writing Plugins
menu: Guide
---

# Writing Plugins

Writing plugins for GiraphQL may seem a little intimidating at first, because the types used by
GiraphQL are fairly complex. Fortunately, for many types of plugins, the process is actually pretty
easy, once you understand the core concepts of how GiraphQL's type system works. Don't worry if the
descriptions don't make complete sense at first. Going the the examples in this guide will hopefully
make things seem a lot easier. This guide aims to cover a lot of the most common use cases for
creating plugins, but does not contain full API documentation. Exploring the types or source code to
see what all is available is highly encouraged, but should not be required for most use cases.

## The type system

GiraphQL has 2 main pieces to it's type system:

1. `GiraphQLSchemaTypes`: A global namespace for shared types
2. `SchemaTypes`: A collection of types passed around through Generics specific to each instance of

   `SchemaBuilder`

### `GiraphQLSchemaTypes`

The `GiraphQLSchemaTypes` contains interfaces for all the various options objects used throughout
the API, along with some other types that plugins may want to extend. Each of the interfaces can be
extended by a plugin to add new options. Each interface takes a number of relevant generic
parameters that can be used to make the options more useful. For example, the interface for field
options will be passed the the shape of the parent, the expected return type, and any arguments.

### `SchemaTypes`

The `SchemaTypes` type is based on the Generic argument passed to the `SchemaBuilder`, and extended
with reasonable defaults. Almost every interface in the `GiraphQLSchemaTypes` will have access to it
\(look for `Types extends SchemaTypes` in the generics of almost any interface\). This Type contains
the types for Scalars, backing models for some object and interface types, and many custom
properties from various plugins. If your plugin needs the user to provide some types that will be
shared across the whole schema, this is how you will be able to access them when adding fields to
the options objects defined in `GiraphQLSchemaTypes`.

## Getting Started

The best place to start is by looking through the
[example plugin](https://github.com/hayes/giraphql/tree/main/packages/plugin-example).

The general structure of a plugin has 3 main parts:

1. `index.ts` which contains a plugins actual implementation
2. `global-types.ts` which contains any additions to `GiraphQL`s built in types.
3. `types.ts` which should contain any types that do NOT belong to the global `GiraphQLSchemaTypes`

   namespace.

To get set up quickly, you can copy these files from the example plugin to suite your needs. The
first few things to change are:

1. The plugin name in `index.ts`
2. The name of the Plugin class in `index.ts`
3. The name key/name for the plugin in the `Plugins` interface in `global-types.ts`

After setting up the basic layout of your plugin, I recommend starting by defining the types for
your plugin first \(in `global-types.ts`\) and setting up a test schema that uses your plugin. This
allows you to get the user facing API for your plugin working first, so you can see that any new
options you add to the API are working as expected, and that any type constraints are enforced
correctly. Once you are happy with your API, you can start building out the functionality in
index.ts. Building the types first also make the implementation easier because the properties you
will need to access in your extension may not exist on the config objects until you have defined
your types.

### `global-types.ts`

`global-types.ts` must contain the following:

1. A declaration of the `GiraphQLSchemaTypes` namespace

   ```typescript
   declare global {
     export namespace GiraphQLSchemaTypes {}
   }
   ```

2. An addition to the `Plugins` interface that maps the plugin name, to the plugin type \(this needs
   to be inside the `GiraphQLSchemaTypes` namespace\)

   ```typescript
   export interface Plugins<Types extends SchemaTypes> {
     example: GiraphQLExamplePlugin<Types>;
   }
   ```

`global-types.ts` should NOT include definitions that do not belong to the `GiraphQLSchemaTypes`
namespace. Types for your plugin should be added to a separate `types.ts` file, and imported as
needed into `global-types.ts`.

To add properties to the various config objects used by the `SchemaBuilder`, you should start by
finding the interface that defines that config object in `@giraphql/core`. Currently there are 4
main file that define the types that make up `GiraphQLSchemaTypes` namespace.

1. [`type-options.ts`](https://github.com/hayes/giraphql/blob/main/packages/core/src/types/global/type-options.ts):

   Contains the interfaces that define the options objects for the various types \(Object,
   Interface,

   Enum, etc\).

2. [`field-options.ts`](https://github.com/hayes/giraphql/blob/main/packages/core/src/types/global/field-options.ts):

   Contains the interfaces that define the options objects for creating fields

3. [`schema-types.ts`](https://github.com/hayes/giraphql/blob/main/packages/core/src/types/global/schema-types.ts)

   Contains the interfaces for SchemaBuilder options, SchemaTypes, options for `toSchema`, and other

   utility interfaces that may be useful for plugins to extend that do not fall into one of the

   other categories.

4. [`classes.ts`](https://github.com/hayes/giraphql/blob/main/packages/core/src/types/global/classes.ts)

   Contains interfaces that describe the classes used by GiraphQL, include `SchemaBuilder` and the

   various field builder classes.

Once you have identified a type you wish to extend, copy it into the `GiraphQLSchemaTypes` namespace
in your `global-types.ts`, but remove all the existing properties. You will need to keep all the
Generics used by the interface, and should import the types used in generics from `@giraphql/core`.
You can now add any new properties to the interface that your plugin needs. Making new properties
optional \(`newProp?: TypeOfProp`\) is recommended for most use cases.

## `index.ts`

`index.ts` must contain the following:

1. A bare import of the global types \(`import './global-types';`\)
2. The plugins name, which should be typed as a string literal rather than as a generic string:

   `const pluginName = 'example' as const;`

3. A default export of the plugin name `export default pluginName`
4. A class that extends BasePlugin:
   `export class GiraphQLExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}`.

   `BasePlugin` and `SchemaTypes` can both be imported from `@giraphql/core`

5. A call to register the plugin: `SchemaBuilder.registerPlugin(pluginName, GiraphQLExamplePlugin);`

   `SchemaBuilder` can also be imported from `@giraphql/core`

### Life cycle hooks

The `SchemaBuilder` will instantiate plugins each time the `toSchema` method is called on the
builder. As the schema is built, it will invoke the various life cycle methods on each plugin if
they have been defined.

To hook into each lifecycle event, simply define the corresponding function in your plugin class.
For the exact function signature, see the `index.ts` of the example plugin.

- `onTypeConfig`: Invoked for each type, with the config object that will be used to construct the

  underlying GraphQL type.

- `onOutputFieldConfig`: Invoked for each Object, or Interface field, with the config object

  describing the field.

- `onInputFieldConfig`: Invoked for each InputObject field, or field argument, with the config

  object describing the field.

- `onEnumValueConfig`: Invoked for each value in an enum
- `beforeBuild`: Invoked before building schemas, last chance to add new types or fields.
- `afterBuild`: Invoked with the fully built Schema.
- `wrapResolve`: Invoked when creating the resolver for each field
- `wrapSubscribe`: Invoked for each field in the `Subscriptions` object.
- `wrapResolveType`: Invoked for each Union and Interface.

Each of the lifecycle methods above \(except `beforeBuild`\) expect a return value that matches
their first argument \(either a config object, or the resolve/subscribe/resolveType function\). If
your plugin does not need to modify these values, it can simple return the value that was passed in.
When your plugin does need to change one of the config values, you should return a copy of the
config object with your modifications, rather than modifying the config object that was passed in.
This can be done by either using `Object.assign`, or spreading the original config into a new object
`{...originalConfig, newProp: newValue }`.

Each config object will have the properties expected by the GraphQL for creating the types or fields
\(although some properties like `resolve` will be added later\), but will also include a number of
GiraphQL specific properties. These properties include `graphqlKind` to indicate what kind of
GraphQL type the config object is for, `giraphQLOptions`, which contains all the options passed in
to the schema builder when creating the type or field.

If your plugin needs to add additional types or fields to the schema it should do this in the
`beforeBuild` hook. Any types added to the schema after this, may not be included correctly. Plugins
should also account for the fact that a new instance of the plugin will be created each time the
schema is called, so any types or fields added the the schema should only be applied once \(per
schema\), even if multiple instances of the plugin are created. The help with this, there is a
`runUnique` helper on the base plugin class, which accepts a key, and a callback, and will only run
a callback once per schema for the given key.

## Use cases

Below are a few of the most common use cases for how a plugin might extend the GiraphQL with very
simplified examples. Most plugins will likely need a combination of these strategies, and some uses
cases may not be well documented. If you are unsure about how to solve a specific problem, feel free
to open a GitHub Issue for more help.

In the examples below, when "extending an interface", the interface should be added to the
`GiraphQLSchemaTypes` namespace in `global-types.ts`.

### Adding options to the SchemaBuilder constructor

You may have noticed that plugins are not instantiated by the user, and therefore users can't pass
options directly into your plugin when creating it. Instead, the recommended way to configure your
plugin is by contributing new properties to the options object passed the the SchemaBuilder
constructor. This can be done by extending the `SchemaBuilderOptions` interface.

```typescript
export interface SchemaBuilderOptions<Types extends SchemaTypes> {
  optionInRootOfConfig?: boolean;
  nestedOptionsObject?: ExamplePluginOptions; // imported from types.ts
}
```

Extending this interface will allow the user to pass in these new options when creating an instance
of `SchemaBuilder`.

You can then access the options through `this.builder.options` in your plugin, with everything
correctly typed:

```typescript
export class GiraphQLExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    console.log(this.builder.options.optionInRootOfConfig)

    return typeConfig;
  }
```

### Adding options when building a schema \(`toSchema`\)

In some cases, your plugin may be designed for schemas that be built in different modes. For example
the mocks plugin allows the schema to be built repeatedly with different sets of mocks, or the
subGraph allows building a schema multiple times to generate separate subgraphs. For these cases,
you can extend the options passed to `toSchema` instead:

```typescript
export interface BuildSchemaOptions<Types extends SchemaTypes> {
  customBuildTimeOptions?: boolean;
}
```

These options can be accessed through `this.options` in your plugin:

```typescript
export class GiraphQLExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    console.log(this.options.customBuildTimeOptions)

    return typeConfig;
  }
```

### Adding options to types

Each GraphQL type has it's own options interface which can be extended. For example, to extend the
options for creating an Object type:

```typescript
export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
  optionOnObject?: boolean;
}
```

These options can then be accessed in your plugin when you receive the config for the type:

```typescript
export class GiraphQLExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    if (typeConfig.kind === 'Object') {
      console.log(typeConfig.giraphqlOptions.optionOnObject);
    }

    return typeConfig;
  }
```

In the example above, we need to check `typeConfig.kind` to ensure that the type config is for an
object. Without this check, typescript will not know that the config object is for an object, and
will not let us access the property. `typeConfig.kind` corresponds to how GiraphQL splits up Types
for its config objects, meaning that it has separate `kind`s for `Query`, `Mutation`, and
`Subscription` even though these are all `Objects` in GraphQL terminology. The
`typeConfig.graphqlKind` can be used to get the actual GraphQL type instead.

### Adding options to fields

Similar to Types, fields also have a number of interfaces that can be extended to add options to
various types of fields:

```typescript
export interface MutationFieldOptions<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  ResolveReturnShape
> {
  customMutationFieldOption?: boolean;
}
```

Field interfaces have a few more generics than other interfaces we have looked at. These generics
can be used to make the options you add more specific to the field currently being defined. It is
important to copy all the generics of the interfaces as they are defined in `@giraphql/core` even if
you do not use the generics in your own properties. If the generics do not match, typescript won't
be able to merge the definitions. You do NOT need to include the `extends` clause of the interface,
if the interface extends another interface \(like `FieldOptions`\).

Similar to Type options, Field options will be available in the fieldConfigs in your plugin, once
you check that the fieldConfig is for the correct `kind` of field.

```typescript
export class GiraphQLExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    if (fieldConfig.kind === 'Mutation') {
      console.log(fieldConfig.giraphqlOptions.customMutationFieldOption);
    }

    return fieldConfig;
  }
}
```

### Adding new methods on builder classes

Adding new method to `SchemaBuilder` or one of the `FieldBuilder` classes is also done through
extending interfaces. Extending these interfaces is how typescript is able to know these methods
exist, even though they are not defined on the original classes.

```typescript
export interface SchemaBuilder<Types extends SchemaTypes> {
  buildCustomObject: () => ObjectRef<{ custom: 'shape' }>;
}
```

The above is a simple example of defining a new `buildCustomObject` method that takes no arguments,
and returns a reference to a new custom object type. Defining this type will not work on it's own,
and we still need to define the actual implementation of this method. This might look like:

```typescript
const schemaBuilderProto = SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.buildCustomObject = function buildCustomObject() {
  return this.objectRef<{ custom: 'shape' }>('CustomObject').implement({
    fields: () => ({}),
  });
};
```

Note that the above function does NOT use an arrow function, so that the function can access `this`
as a reference the the SchemaBuilder instance.

### Wrapping resolvers to add runtime functionality

Some plugins will need to add runtime behavior. There are a few lifecycle hooks for wrapping
`resolve`, `subscribe`, and `resolveType`. These hooks will receive the function they are wrapping,
along with a config object for the field or type they are associated with, and should return either
the original function, or a wrapper function with the same API.

It is important to remember that resolvers can resolve values in a number of ways \(normal values,
promises, or even something as complicated `Promise<(Promise<T> | T)[]>`. So be careful when using a
wrapper that introspected the return value of a resolve function. Plugins should only wrap resolvers
when absolutely necessary.

```typescript
export class GiraphQLExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return (parent, args, context, info) => {
      console.log(`Resolving ${info.parentType}.${info.fieldName}`);

      return resolver(parent, args, context, info);
    };
  }
}
```

### Transforming a schema

For some plugins the other provided lifecycle may not be sufficiently powerful to modify the schema
in all the ways a plugin may want. For example removing types from the schema \(eg. the `SubGraph`
plugin\). In these cases, the `afterBuild` hook can be used. It receives the built schema, and is
expected to return either the schema it was passed, or a completely new schema. This allows plugins
to use 3rd party libraries like `graphql-tools` to arbitrarily transform schemas if desired.

### Using SchemaTypes

You may have noticed that almost every interface and type in `@giraphql/core` take a generic that
looks like: `Types extends SchemaTypes`. This type is what allows GiraphQL and its plugins to share
type information across the entire schema, and to incorporate user defined types into that system.
These SchemaTypes are a combination of default types merged with the Types provided in the Generic
parameter of the SchemaBuilder constructor, and includes a wide variety of useful types:

- Types for all the scalars
- Types for backing models used by objects and interfaces when referenced via strings
- The type used for the context and root objects
- Settings for default nullability of fields
- Any user defined types specific to plugins \(more info below\)

There are many ways these types can be used, but one of the most common is to access the type for
the context object, so that you can correctly type a callback function for your plugin that accepts
the context object.

```typescript
export interface SchemaBuilderOptions<Types extends SchemaTypes> {
  exampleSetupFn?: (context: Types['Context']) => ExamplePluginSetupConfig;
}
```

### Using user defined types

As mentioned above, your plugin can also contribute its own user definable types to the SchemaTypes
interface. You can see examples of this in the several of the plugins including the directives and
`scope-auth` plugins. Adding your own types to SchemaTypes requires extending 2 interfaces: The
`UserSchemaTypes` which describes the user provided type will need to extend, and the
`ExtendDefaultTypes` interface, which is used to set default values if the User does not provide
their own types.

```typescript
export interface UserSchemaTypes {
  NewExampleTypes: Record<string, ExampleShape>;
}

export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
  NewExampleTypes: undefined extends PartialTypes['NewExampleTypes']
    ? {}
    : PartialTypes['NewExampleTypes'] & {};
}
```

The User provided type can then be accessed using `Types['NewExampleTypes']` in any interface or
type that receive `SchemaTypes` as a generic argument.

### Request data

Plugins that wrap resolvers may need to store some data that us unique the current request. In these
cases your plugin can define a `createRequestData` method, and use the `requestData` method to get
the data for the current request.

```typescript
export class GiraphQLExamplePlugin<Types extends SchemaTypes, { resolveCount: number }> extends BasePlugin<Types> {
  createRequestData(context: Types['Context']): T {
    return { resolveCount: 0 };
  }

  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return (parent, args, context, info) => {
      const requestData = this.requestData(context);

      requestData.resolveCount += 1;

      console.log(`request has resolved ${requestData.resolveCount} fields`);

      return resolver(parent, args, context, info);
    };
  }
}
```

The shape of requestData can be defined via the second generic parameter of the `BasePlugin` class.
The `requestData` method expects the context object as its only argument, which is used to uniquely
identify the current request.

### Wrapping arguments and inputs

The plugin API does not directly have a method for wrapping input fields, instead, the `wrapResolve`
and `wrapSubscribe` methods can be used to modify the `args` object before passing it down to the
original resolver.

Figuring out how to wrap inputs can be a little complex, especially when dealing with recursive
inputs, and optimizing to wrap as little as possible. To help with this, giraphql has a couple of
utility functions that can make this easier:

- `mapInputFields`: Used to select affected input fields and extract some configuration
- `createInputValueMapper`: Creates a mapping function that uses the result of `mapInputFields` to
  map inputs in an args object to new values.

The relay plugin uses these methods to decode `globalID` inputs:

```typescript
export class GiraphQLRelayPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    // Given the args for the this field, select the fields that are globalIds
    const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (inputField) => {
      if (inputField.extensions?.isRelayGlobalID) {
        return true;
      }

      // returning null means no mapping will be created for this input field
      return null;
    });

    // If all fields reachable through args return null for their mapping, we don't need to wrap the resolver
    if (!argMappings) {
      return resolver;
    }

    // Calls the mapping function for each value with a mapping if the value is not null or undefined
    const argMapper = createInputValueMapper(argMappings, (globalID, mapping) =>
      internalDecodeGlobalID(this.builder, String(globalID)),
    );

    return (parent, args, context, info) => resolver(parent, argMapper(args), context, info);
  }
}
```

Using these utilities allows moving more logic to build time (figuring out which fields need
mapping) so that the runtime overhead is as small as possible.

`createInputValueMapper` may be useful for some use cases, for some plugins it may be better to
create a custom mapping function, but still use the result of `mapInputFields`.

`mapInputFields` returns a map who's keys are field/argument names, and who's values are objects
with the following shape:

```typescript
interface InputFieldMapping<Types extends SchemaTypes, T> {
  kind: 'Enum' | 'Scalar' | 'InputObject';
  isList: boolean;
  config: GiraphQLInputFieldConfig<Types>;
  value: T; // the value returned by the mapping function (if it was not null).
  // The value may still be for `InputObject` mappings if there are nested fields with non-null mappings
}
```

if the `kind` is `InputObject` then the mapping object will also have a fields property with an
object of the following shape:

```typescript
interface InputTypeFieldsMapping<Types extends SchemaTypes, T> {
  configs: Record<string, GiraphQLInputFieldConfig<Types>>;
  map: Map<string, InputFieldMapping<Types, T>> | null;
}
```

Both the root level map, and the `fields.map` maps will only contain entries for fields where the
mapping function did not return null. If the mapping function returned null for all fields, the
`mapInputFields` will return null instead of returning a map to indicate no wrapping should occur

## Useful methods:

- `builder.configStore.onTypeConfig`: Takes a type ref and a callback, and will invoke the callback

  with the config for the referenced type once available.

- `builder.configStore.onFieldUse` Takes a field ref \(returned by a field builder\) and a callback
  to

  invoke once the config for the field is available.

- `buildCache.getTypeConfig` Gets the config for a given type after it has been passed through any

  modifications applied by plugins.
