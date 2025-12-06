# Playground URL State Specification

## Overview

The Pothos Playground uses a **human-readable, parameterized URL format** (v3) to enable sharing of playground configurations. Metadata like queries, view mode, and settings are readable in the URL, while only code is compressed for efficiency.

## URL Format

### Version 3 (Current - Human-Readable)

```
https://example.com/playground#v=3&view=graphql&query={hello}&code=<compressed>
```

**Key Features:**
- ✅ **Human-readable parameters**: `view`, `query`, `vars`, etc. are plain text
- ✅ **Only code is compressed**: Using `lz-string` for efficient encoding
- ✅ **URLSearchParams format**: Standard, parseable by all tools
- ✅ **Backward compatible**: Old v1/v2 URLs still work

### Legacy Formats (Backward Compatible)

```
# v2 format (auto-detected and supported)
https://example.com/playground#N4IgbiBcBMA0IDMo...<compressed-json>

# v1 format (auto-migrated to v3)
https://example.com/playground#N4IgJg9gxg...<compressed-json>
```

## State Schema

### Version 3 (Current - Human-Readable)

```typescript
interface PlaygroundURLState {
  files: Array<{
    filename: string;
    content: string;
    language?: 'typescript' | 'graphql';
  }>;
  query?: string;
  variables?: string;
  activeTab?: string;
  viewMode?: 'code' | 'graphql';
  settings?: {
    autoCompile?: boolean;
    debounceMs?: number;
    theme?: 'light' | 'dark' | 'auto';
    fontSize?: number;
    [key: string]: unknown; // Extensible for future settings
  };
}
```

### URL Parameters (v3)

The state uses URLSearchParams with human-readable names:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `v` | string | Version number (always "3") | `v=3` |
| `view` | string | View mode: "code" or "graphql" | `view=graphql` |
| `query` | string | GraphQL query (URL-encoded) | `query={hello}` |
| `vars` | string | GraphQL variables (JSON string) | `vars={"id":"123"}` |
| `tab` | string | Active tab filename | `tab=schema.ts` |
| `theme` | string | Theme: "light", "dark", or "auto" | `theme=dark` |
| `fontSize` | number | Editor font size | `fontSize=16` |
| `autoCompile` | boolean | Auto-compile on change | `autoCompile=true` |
| `debounceMs` | number | Compile debounce delay | `debounceMs=500` |
| `code` | string | **Compressed files** (lz-string) | `code=NobwRA...` |

**Example URL:**
```
/playground#v=3&view=graphql&query=%7Bhello%7D&vars=%7B%22name%22%3A%22World%22%7D&code=NobwRAdmBc...
```

**Human-readable interpretation:**
- Version: 3
- View: graphql
- Query: {hello}
- Variables: {"name":"World"}
- Code: <compressed content>

### Legacy Encoded Format (v2)

For backward compatibility, v2 uses fully compressed JSON:

```typescript
interface EncodedStateV2 {
  v: 2;
  f: Array<{ n: string; c: string; l?: string }>;
  q?: string;
  vars?: string;
  t?: string;
  m?: 'c' | 'g';
  s?: PlaygroundSettings;
}
```

## Versioning and Migration

### Version History

- **v1** (Legacy): Initial format with basic file, query, and view mode support
- **v2** (Current): Added support for:
  - Multiple files with language metadata
  - GraphQL variables
  - Settings object for customization
  - Extensible settings with index signature

### Backward Compatibility

The playground maintains backward compatibility with v1 URLs through automatic migration:

1. When a v1 URL is detected, it's automatically migrated to v2 format
2. A console info message is logged during migration
3. All v1 fields are preserved in the v2 structure
4. The URL is not automatically updated to avoid breaking browser history

```typescript
// v1 state is migrated to v2
function migrateV1ToV2(state: EncodedStateV1): PlaygroundURLState {
  return {
    files: state.f.map(f => ({ filename: f.n, content: f.c })),
    query: state.q,
    activeTab: state.t,
    viewMode: state.m === 'c' ? 'code' : state.m === 'g' ? 'graphql' : undefined,
  };
}
```

## Usage Examples

### Creating a Shareable URL

```typescript
import { createShareableURL } from '@/lib/playground/url-state';

const shareUrl = createShareableURL({
  files: [
    {
      filename: 'schema.ts',
      content: `import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      resolve: () => 'Hello, World!',
    }),
  }),
});

export const schema = builder.toSchema();`,
    },
  ],
  query: '{ hello }',
  viewMode: 'graphql',
});

// Result: https://example.com/playground#N4IgJg9gxg...
```

### Multiple Files

```typescript
const state = {
  files: [
    {
      filename: 'schema.ts',
      content: '...',
      language: 'typescript',
    },
    {
      filename: 'types.ts',
      content: '...',
      language: 'typescript',
    },
  ],
  activeTab: 'schema.ts',
  viewMode: 'code',
};
```

### With GraphQL Variables

```typescript
const state = {
  files: [
    {
      filename: 'schema.ts',
      content: '...',
    },
  ],
  query: `
    query GetUser($id: ID!) {
      user(id: $id) {
        name
        email
      }
    }
  `,
  variables: JSON.stringify({ id: '123' }),
  viewMode: 'graphql',
};
```

### With Custom Settings

```typescript
const state = {
  files: [
    {
      filename: 'schema.ts',
      content: '...',
    },
  ],
  settings: {
    autoCompile: true,
    debounceMs: 1000,
    theme: 'dark',
    fontSize: 16,
  },
};
```

## Future Extensibility

The v2 format is designed for extensibility:

1. **Settings Object**: The `settings` field uses an index signature (`[key: string]: unknown`) to allow adding new settings without version bumps
2. **Optional Fields**: All non-essential fields are optional, making it easy to add new features
3. **Versioning**: When breaking changes are needed, increment the version number and add migration logic

### Adding New Features

To add a new feature without breaking compatibility:

1. Add the field as optional in `PlaygroundURLState`
2. Add the shortened property in `EncodedStateV2`
3. Update encoding/decoding logic
4. Existing URLs continue to work (missing fields are undefined)

Example - adding a new setting:

```typescript
// 1. Add to interface
interface PlaygroundSettings {
  // ... existing settings
  lineWrapping?: boolean; // New setting
}

// 2. Encoding/decoding automatically handles it (index signature)
// No code changes needed!
```

## Best Practices

1. **Keep URLs Short**: Only include non-default values in the URL
2. **Test Migration**: When updating the schema, always test that old URLs still work
3. **Version Bumps**: Only bump version for breaking changes
4. **Compression**: LZ-String handles compression; focus on minimal JSON structure
5. **Validation**: Always handle decode failures gracefully (return `null`)

## Implementation Notes

- **Compression**: Uses `lz-string` for efficient URL encoding
- **Storage**: State is stored in URL hash (`window.location.hash`)
- **Sync**: State is synced to URL on every change (with debouncing at component level)
- **Initialization**: URL state is loaded once on page mount
- **Sharing**: Share button copies full URL to clipboard

## Testing

See `__tests__/url-state.test.ts` for comprehensive test coverage including:
- Basic encoding/decoding
- Multiple files
- Query and variables
- Settings
- Large content
- Error handling
- Migration from v1 to v2
