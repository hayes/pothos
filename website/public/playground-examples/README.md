# Playground Examples

This directory contains examples for the Pothos GraphQL Playground. Each example demonstrates different features and capabilities of Pothos.

## Directory Structure

Each example is stored in its own directory with three files:

```
example-name/
├── schema.ts        # TypeScript schema code
├── query.graphql    # Default GraphQL query
└── metadata.json    # Example metadata (title, description, tags)
```

### Example Structure

**schema.ts** - The Pothos schema definition:
```typescript
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define your schema here...

export const schema = builder.toSchema();
```

**query.graphql** - Default query to demonstrate the schema:
```graphql
query {
  # Your query here
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
   - `schema.ts` - Your schema code
   - `query.graphql` - A default query
   - `metadata.json` - Example metadata

3. **Build the examples bundle:**
   ```bash
   pnpm --filter @pothos/website build-examples
   ```

   This generates `playground-examples.json` which is imported by the playground.

4. **Test your example:**
   - Run `pnpm dev` in the website directory
   - Navigate to the playground
   - Select your example from the dropdown

## Build Process

Examples are bundled at build time by `scripts/build-playground-examples.ts`:

1. Reads all directories in `public/playground-examples/`
2. Loads the three files from each directory
3. Bundles them into `public/playground-examples.json`
4. This JSON is imported by the playground loader

The build happens automatically before Next.js build via the `prebuild` script.

## Guidelines for Examples

### Schema Code (`schema.ts`)

- ✅ Must export `schema` as the default export
- ✅ Should be self-contained and runnable
- ✅ Include comments explaining key concepts
- ✅ Use realistic but simple data
- ✅ Keep under 200 lines if possible
- ❌ Don't use external dependencies beyond Pothos
- ❌ Avoid complex business logic

### Query (`query.graphql`)

- ✅ Demonstrate key features of the schema
- ✅ Include comments for complex queries
- ✅ Show different query patterns if relevant
- ✅ Use meaningful field selections
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
- **Built bundle**: `website/public/playground-examples.json`
- **Loader**: `website/components/playground/examples/index.ts`
- **Build script**: `website/scripts/build-playground-examples.ts`
- **Migration script**: `website/scripts/migrate-examples.ts`

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

## Future Improvements

Potential enhancements:
- [ ] Add `variables.json` for query variables
- [ ] Support multiple query files per example
- [ ] Add example categories/sections
- [ ] Generate example documentation automatically
- [ ] Add validation script for example quality
- [ ] Support example dependencies/chaining

---

**Last Updated**: December 2025
**Maintainer**: Pothos Team
