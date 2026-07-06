# Playground Examples

Interactive examples for the Pothos Playground, organized by category with support for single-sourced doc snippets and multi-step tutorials.

## Quick Start

### Create a New Example

```bash
# 1. Create directory
mkdir playground-examples/my-example

# 2. Add metadata.json
cat > playground-examples/my-example/metadata.json << 'JSON'
{
  "id": "my-example",
  "title": "My Example",
  "description": "What this demonstrates",
  "category": "core",
  "subcategory": "getting-started",
  "difficulty": "beginner",
  "order": 10
}
JSON

# 3. Add schema.ts
cat > playground-examples/my-example/schema.ts << 'TS'
import SchemaBuilder from '@pothos/core';
const builder = new SchemaBuilder({});
// Your schema here
export const schema = builder.toSchema();
TS

# 4. Build
pnpm build-examples
```

## Features

- **📂 Multi-file examples** - Multiple TypeScript files become tabs
- **🔍 Single-sourced docs** - `// #region` markers let docs embed exact, always-in-sync slices of a bundle's source
- **📚 Categories** - Organized learning paths
- **🎯 Difficulty levels** - Beginner, intermediate, advanced
- **📝 Multi-step tutorials** - Progressive examples
- **🔗 Documentation links** - Connect examples to guides

## Single-sourcing docs from a bundle

Docs no longer hand-copy code out of a bundle. Instead, a bundle's source
file marks named slices with VS Code `// #region <name>` … `// #endregion
<name>` comments, and the docs pull them in at MDX compile time. The build
strips these marker comments from the emitted bundle, so they never show up
in the playground editor.

```ts
// schema.ts
// #region race-ref
const Race = builder.objectRef<IRace>('Race');
// #endregion race-ref
```

Embed one contiguous region with fumadocs `<include>`, or stitch several
non-adjacent regions with the local `<includeregions>` element:

```mdx
<include cwd lang="typescript" meta='playground example="fundamentals-objects"'>playground-examples/fundamentals-objects/schema.ts#race-ref</include>

<includeregions cwd lang="typescript" meta='playground example="fundamentals-objects"'>playground-examples/fundamentals-objects/schema.ts#race-model,race-ref,race-implement</includeregions>
```

The `tests/playground-docs-validation.test.ts` suite resolves every region
against its target file, so a renamed or deleted marker fails CI.

## Multi-step tutorials

An example that walks a progression puts each step in a `step-N/` subdirectory, each a self-contained unit with its own `schema.ts` (+ optional `query.graphql`). Steps are declared in `metadata.json` under `steps` and are published as `<id>-step-<N>` bundles. Reference a step from docs with the `-step-N` suffix: `example="patterns-handling-errors-step-1"`.

## Definition-style variants

An example that shows the **same** schema implemented several ways (e.g. object refs vs. classes vs. a `SchemaTypes`-generic builder) uses variants. Variants are authored like steps:

- The **default** variant is the example's top-level `schema.ts` and keeps the base id (`fundamentals-objects`).
- Every **other** variant lives in a `variant-<slug>/` subdirectory with its own `schema.ts` (+ optional `query.graphql`, which falls back to the base example's query). It is published as `<id>-variant-<slug>` (`fundamentals-objects-variant-classes`).

Declare the variants in `metadata.json`, marking exactly one `default`:

```json
{
  "id": "fundamentals-objects",
  "title": "Object types",
  "variants": [
    { "id": "object-refs", "title": "Object refs", "order": 1, "default": true },
    { "id": "classes", "title": "Classes", "order": 2 },
    { "id": "builder-types", "title": "Builder types", "order": 3 }
  ]
}
```

Directory layout:

```
fundamentals-objects/
  metadata.json
  schema.ts            # default variant — its id (object-refs) is informational;
                       # reference it by the base id, never `-variant-object-refs`
  query.graphql        # shared default query
  variant-classes/
    schema.ts
  variant-builder-types/
    schema.ts
```

In docs, each variant is its own fence with a `tab="<Label>"` attribute; consecutive tabbed fences merge into a single switchable code block via fumadocs' built-in code-block tabs (see [`content/docs/playground.mdx`](../content/docs/playground.mdx)). Each fence's `example` is the exact bundle it opens (`<base>` for the default, `<base>-variant-<slug>` for the rest). Variant bundles do **not** appear as separate entries in the ExamplesPicker — only the base example does. A bundle may use steps **or** variants, never both.

## Categories

- **core** - Core Pothos concepts
  - getting-started, type-system, advanced-patterns
- **plugins** - Plugin features
  - essential-plugins, advanced-plugins
- **examples** - Real-world implementations
  - complete-apis, patterns

## Commands

```bash
pnpm build-examples    # Build all examples
pnpm test:examples     # Type-check examples
```

See full documentation in this file.
