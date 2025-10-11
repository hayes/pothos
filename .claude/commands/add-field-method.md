---
argument-hint: [method-name] [description]
description: Add a new field builder method to RootFieldBuilder
---

Add a new field builder method called `$1` to the RootFieldBuilder.

**Purpose:** $ARGUMENTS (starting from $2)

This will allow users to call `t.$1()` when defining fields on Query, Mutation, Subscription, Object, and Interface types.

## Implementation Steps

I'll implement this by:

1. **Analyzing the requirements**
   - Understand what the method should do based on the description
   - Determine which implementation pattern to use
   - Identify what options the method needs

2. **Adding the method signature to `global-types.ts`**
   - Extend the `RootFieldBuilder` interface in the `PothosSchemaTypes` namespace
   - Define the method with proper generic types
   - Include all necessary options based on the functionality

3. **Creating the options type in `types.ts`**
   - Define an options interface that extends `FieldOptionsFromKind`
   - Add any custom options your method needs

4. **Implementing the method in `field-builder.ts`**
   - Get the prototype: `RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>`
   - Implement the method function (NOT arrow function)
   - Typically calls `this.field()` with modified options or custom resolver

5. **Importing the implementation**
   - Add `import './field-builder';` to `index.ts` if not already present

## Implementation Patterns

**Pattern 1: Simple Wrapper** (like `fieldWithInput`)
- Used when: Modifying field options or creating related types
- Calls `this.field()` with modified options
- May use `fieldRef.onFirstUse()` to create types dynamically

**Pattern 2: Custom Resolver** (like `globalID`, `node`, `loadable`)
- Used when: Transforming resolve behavior or return values
- Wraps or replaces the resolve function
- Handles async operations, data loading, or transformations

**Pattern 3: Dynamic Type Creation** (like `connection`)
- Used when: Creating complex types based on field configuration
- Creates type refs and implements them on first use
- Uses `fieldRef.onFirstUse()` to access field config

## Reference Examples

- Simple wrapper: `/packages/plugin-with-input/src/schema-builder.ts` - `fieldWithInput`
- Custom resolver: `/packages/plugin-relay/src/field-builder.ts` - `globalID`, `node`
- Advanced dataloading: `/packages/plugin-dataloader/src/field-builder.ts` - `loadable`, `loadableList`
- Dynamic types: `/packages/plugin-relay/src/field-builder.ts` - `connection`

## Key Implementation Details

1. **Type signature structure:**
```typescript
export interface RootFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind = FieldKind,
> {
  $1: <
    Args extends InputFieldMap,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
    ResolveShape,
    ResolveReturnShape,
  >(
    options: ${1}Options<...>,
  ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, Kind>;
}
```

2. **Implementation structure:**
```typescript
import { RootFieldBuilder, type FieldKind, type SchemaTypes } from '@pothos/core';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.$1 = function $1({ /* destructure options */, ...options }) {
  // Implementation based on the pattern
  return this.field({
    ...options,
    // modifications
  } as never);
};
```

3. **Don't use arrow functions** - use `function` keyword so `this` binds correctly
4. **Use `as never`** when calling `this.field()` (only when absalutely necissary) to satisfy complex generic constraints
5. **Import all needed types** from `@pothos/core`

Now I'll analyze the requirements and implement the `$1` method accordingly.