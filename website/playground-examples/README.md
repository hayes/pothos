# Playground Examples

Interactive examples for the Pothos Playground, organized by category with support for code snippets and multi-step tutorials.

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
- **🔍 Code snippets** - Link to specific line ranges from docs
- **📚 Categories** - Organized learning paths
- **🎯 Difficulty levels** - Beginner, intermediate, advanced
- **📝 Multi-step tutorials** - Progressive examples
- **🔗 Documentation links** - Connect examples to guides

## Example with Snippets

```json
{
  "id": "example-id",
  "title": "Example Title",
  "category": "core",
  "subcategory": "getting-started",
  "difficulty": "beginner",
  "order": 1,
  "snippets": [
    {
      "label": "Creating ObjectRef",
      "filename": "schema.ts",
      "startLine": 11,
      "endLine": 12,
      "description": "Type-safe reference to GraphQL type"
    }
  ]
}
```

Link from docs: `/playground?example=example-id&snippet=0`

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
