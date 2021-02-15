---
name: Using Plugins
menu: Guide
---

# Using Plugins

Using plugins with GiraphQL is fairly easy, but works a little differently than other plugin systems
you may be familiar with. One of the most important things to note is that importing plugins may
have some side effects on the Schema builder, and it is recommended to only import the plugins you
are actually using.

The reason for this is that GiraphQLs plugin system was designed to allow plugins to contribute
features in a way that feels like they are built into the core API, and allow the plugins to take
full advantage of the type system. This means that plugins can extend the core types in GiraphQL
with their own properties, which happens as soon as the plugin is imported.

## Setup

Each plugin should have setup instructions, but should work in a similar way.

First install the plugin:

```bash
npm install --save @giraphql/plugin-scope-auth
# or
yarn add @giraphql/plugin-scope-auth
```

Next import the plugin's default export (which should just be the name of the plugin), and pass it
when you create your schema builder.

```ts
import SchemaBuilder from '@giraphql/core';
import ScopeAuthPlugin from '@giraphql/plugin-scope-auth';

const builder = new SchemaBuilder({
  plugins: [ScopeAuthPlugin],
});
```

Some plugins may allow you to use your own types for one of their features. This is done by passing
types in through the Generic TypeInfo used by the Schema builder:

```ts
import SchemaBuilder from '@giraphql/core';
plugin - scope - auth;

const builder = new SchemaBuilder<{
  AuthScopes: {
    example: string;
  };
}>({
  plugins: [ScopeAuthPlugin],
});
```

This types can then be used in other parts of the API (eg. defining the scopes on a field), but the
details of how these types are used will be specific to each plugin, and should be covered in the
documentation for the plugin.

## Ordering

In some cases, it may be important to understand the order in which plugins are applied. All plugin
lifecycle hooks are applied in REVERSE order. This is done to ensure that the most important (first)
plugins are applied after all other effects have been applied. For plugins that wrap resolvers,
because they fist plugins are applied last, they will be the outermost layer of wrapping an applied
executed first. This means it is important to have plugins like `scope-auth` listed before other
less critical plugins in your SchemaBuilder.
