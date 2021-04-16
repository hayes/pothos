---
name: Validation
menu: Plugins
---

# Validation Plugin

A plugin for adding validation for field arguments based on
[zod](https://github.com/colinhacks/zod). This plugin does not expose zod directly, but most of the
options map closely to the validations available in zod.

## Usage

### Install

```bash
yarn add @giraphql/plugin-validation
```

### Setup

```typescript
import ValidationPlugin from '@giraphql/plugin-validation';
const builder = new SchemaBuilder({
  plugins: [ValidationPlugin],
});

builder.queryType({
  fields: (t) => ({
    simple: t.boolean({
      nullable: true,
      args: {
        // Validate individual args
        email: t.arg.string({
          validate: {
            email: true,
          },
        }),
        phone: t.arg.string({}),
      },
      // Validate all args together
      validate: (args) => !!args.phone || !!args.email,
      resolve: () => true,
    }),
  }),
});
```

```typescript
builder.queryType({
  fields: (t) => ({
    simple: t.boolean({
      nullable: true,
      args: {
        email: t.arg.string({
          validate: {
            email: true,
          },
        }),
        phone: t.arg.string({}),
      },
      validate: (args) => !!args.phone || !!args.email,
      resolve: () => true,
    }),
    withMessage: t.boolean({
      nullable: true,
      args: {
        email: t.arg.string({
          validate: {
            email: [true, { message: 'invalid email address' }],
          },
        }),
        phone: t.arg.string({}),
      },
      validate: [
        (args) => !!args.phone || !!args.email,
        { message: 'Must provide either phone number or email address' },
      ],
      resolve: () => true,
    }),
    list: t.boolean({
      nullable: true,
      args: {
        list: t.arg.stringList({
          validate: {
            items: {
              maxLength: 3,
            },
            maxLength: 3,
          },
        }),
      },
      resolve: () => true,
    }),
  }),
});
```

## Overview

The validation plugin will allow allow different validations depending on the types for the field or
argument being defined. For instance a `Float` field (`number`) can use `max` and `min` validations,
and `String` field can validate things like `maxLength` or if the string is an email. The options
available are purely driven by the typesystem
