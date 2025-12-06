# Playground Examples

This directory contains source examples for the Pothos GraphQL Playground. Each example demonstrates different features and capabilities of Pothos.

## Location

- **Source**: `website/playground-examples/` (this directory)
- **Build Output**: `website/public/playground-examples/*.json` (generated bundles)

Examples are maintained as separate source files here and bundled into JSON at build time for the playground to load dynamically.

## Directory Structure

Each example is stored in its own directory with the following files:

```
example-name/
├── schema.ts        # Main TypeScript schema code (required)
├── types.ts         # Additional TypeScript files (optional)
├── resolvers.ts     # More TypeScript files (optional)
├── query.graphql    # GraphQL query files (optional, can have multiple)
├── mutations.graphql # Additional query files (optional)
├── tsconfig.json    # TypeScript configuration (isolates each example)
└── metadata.json    # Example metadata (required)
```

**Required files:**
- `metadata.json` - Example metadata
- At least one `.ts` file (typically `schema.ts`)

**Optional files:**
- Additional `.ts` files - Will be loaded as separate tabs in the editor
- `.graphql` files - Query files (first one is used as default query)

### File Structure

**TypeScript files** (`.ts`) - Schema and supporting code:
```typescript
// schema.ts (main file, should export schema)
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define your schema here...

export const schema = builder.toSchema();
```

```typescript
// types.ts (optional, for shared types)
export interface User {
  id: string;
  name: string;
}
```

**GraphQL files** (`.graphql`) - Query/mutation examples:
```graphql
# query.graphql - First query file becomes the default
query {
  # Your query here
}
```

```graphql
# mutations.graphql - Additional query files for examples
mutation CreateUser($name: String!) {
  createUser(name: $name) {
    id
    name
  }
}
```

**metadata.json** - Example metadata:
```json
{
  "id": "example-name",
  "title": "Example Display Name",
  "description": "Brief description of what this example demonstrates",
  "tags": ["beginner", "plugin-name"]
}
```

## Available Examples

### Core Examples

1. **basic-types** - Object types and queries
2. **mutations** - Mutations with input types
3. **interfaces** - GraphQL interfaces
4. **enums-args** - Enums and typed arguments
5. **unions** - Union types for polymorphic results

### Plugin Examples

6. **simple-objects-plugin** - Simple Objects plugin for reduced boilerplate
7. **relay-plugin** - Relay plugin with cursor-based pagination
8. **with-input-plugin** - With-Input plugin for field input objects

## Adding a New Example

1. **Create the directory:**
   ```bash
   mkdir website/public/playground-examples/my-example
   ```

2. **Create the files:**
   - `schema.ts` - Your main schema code (required)
   - Additional `.ts` files - Optional supporting code
   - `.graphql` files - Optional query examples
   - `metadata.json` - Example metadata (required)

3. **Build the examples index:**
   ```bash
   pnpm --filter @pothos/website build-examples
   ```

   This generates the examples index used by the playground loader.

4. **Test your example:**
   - Run `pnpm dev` in the website directory
   - Navigate to the playground
   - Select your example from the examples panel

### Example with Multiple Files

Here's an example with multiple TypeScript files:

```
advanced-example/
├── schema.ts        # Main schema definition
├── types.ts         # Shared TypeScript types
├── resolvers.ts     # Resolver implementations
├── queries.graphql  # Sample queries
├── mutations.graphql # Sample mutations
└── metadata.json    # Metadata
```

All `.ts` files will appear as tabs in the code editor, allowing users to see how the code is organized.

## Build Process

Examples are indexed at build time by `scripts/build-playground-examples.ts`:

1. Scans all directories in `public/playground-examples/`
2. Reads all `.ts` and `.graphql` files from each directory
3. Generates an index file with metadata at `components/playground/examples/examples-index.generated.ts`
4. Files are loaded on-demand from the public directory when an example is selected

The build happens automatically before Next.js build via the `prebuild` script.

**File loading order:**
- TypeScript files are sorted alphabetically with `schema.ts` always first
- The first `.graphql` file found is used as the default query
- All TypeScript files become tabs in the code editor

## Guidelines for Examples

### TypeScript Code (`.ts` files)

- ✅ `schema.ts` must export `schema` as the default export
- ✅ Additional files can export types, constants, or utilities
- ✅ Should be self-contained and runnable
- ✅ Include comments explaining key concepts
- ✅ Use realistic but simple data
- ✅ Split complex examples into multiple files for clarity
- ✅ Keep each file focused on a single concern
- ✅ Keep files under 200 lines if possible
- ❌ Don't use external dependencies beyond Pothos
- ❌ Avoid complex business logic

### GraphQL Files (`.graphql`)

- ✅ Demonstrate key features of the schema
- ✅ Include comments for complex queries
- ✅ Create separate files for queries, mutations, subscriptions
- ✅ Show different query patterns across multiple files
- ✅ Use meaningful field selections
- ✅ Name files descriptively (e.g., `queries.graphql`, `mutations.graphql`)
- ❌ Don't make queries too complex

### Metadata (`metadata.json`)

- ✅ Use kebab-case for IDs
- ✅ Keep titles short (2-4 words)
- ✅ Write clear, concise descriptions
- ✅ Add relevant tags for filtering
- ❌ Don't duplicate information

### Example Tags

Use tags to help users find examples:
- `beginner`, `intermediate`, `advanced` - Difficulty level
- `plugin-<name>` - Uses a specific plugin
- `relay`, `auth`, `errors`, etc. - Feature categories

## Development Workflow

### Editing an Example

1. Edit the files in `public/playground-examples/<example-name>/`
2. Run `pnpm build-examples` to regenerate the bundle
3. Refresh the playground to see changes

### Migration from Old Format

Old examples were inline TypeScript objects. We provide a migration script:

```bash
pnpm --filter @pothos/website exec tsx scripts/migrate-examples.ts
```

This reads the old example files and converts them to the new structure.

## File Locations

- **Source files**: `website/public/playground-examples/*/`
- **Generated index**: `website/components/playground/examples/examples-index.generated.ts`
- **Loader**: `website/components/playground/examples/index.ts`
- **Build script**: `website/scripts/build-playground-examples.ts`

## Troubleshooting

### Example not showing up

1. Check that all three files exist in the directory
2. Verify `metadata.json` has valid JSON syntax
3. Run `pnpm build-examples` to rebuild
4. Check console for any errors

### Schema doesn't compile

1. Verify `schema.ts` exports `schema`
2. Check for TypeScript syntax errors
3. Ensure all imports are from `@pothos/core` or plugins
4. Test the schema code in isolation

### Query doesn't work

1. Verify query syntax is valid GraphQL
2. Check that queried fields exist in schema
3. Test query in GraphiQL after schema loads
4. Look at console for execution errors

## Best Practices

1. **Keep it simple** - Examples should be educational, not production code
2. **Self-contained** - Each example should work independently
3. **Well-commented** - Explain what's happening and why
4. **Tested** - Make sure the example actually works
5. **Consistent** - Follow existing examples' style

## Features

Current capabilities:
- ✅ Multiple TypeScript files per example (tabbed editor)
- ✅ Multiple GraphQL query files per example
- ✅ Files loaded on-demand from public directory
- ✅ Shareable URLs with full playground state
- ✅ Active file tab tracked in URL state

## Future Improvements

Potential enhancements:
- [ ] Add `variables.json` for query variables
- [ ] Add example categories/sections in UI
- [ ] Generate example documentation automatically
- [ ] Add validation script for example quality
- [ ] Support example dependencies/chaining
- [ ] File directory browser in examples panel

---

**Last Updated**: December 2025
**Maintainer**: Pothos Team
