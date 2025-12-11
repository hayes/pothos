# Human-Readable Playground URLs (v3)

## Summary

The Pothos playground now uses **human-readable, parameterized URLs** where you can see the query, view mode, variables, and settings directly in the URL. Only the code content is compressed for efficiency.

## Before vs After

### Before (v2) - Everything Compressed
```
/playground#N4IgbiBcBMA0IDMoG1QDsogM4GMAWApgLYCGAdAC5Yjw6YCWRADgPYBOFABAMr7EkAhAK70ANgBMCbTgjYsinAOQABVhTwssAehzsCigNwAdNCd1osXAEYiJUzgF5OaAgHcefUsLGS2ACmAAXwBKY1M0Gx8pMgBHISkATwAVBKYCAJNOGXoCCSxITj8KYMcAPkLgTKzOQlFRFgKKMks2ejQAcwy0auq2AiwWUTACAr8Sh3LFAAlc+thOAHV2CQBCRVgqrJCN7s5tkxCwkwIAD1YOTnNLTlxCUkdOSLs2ShZeO5IxgxBAgF14GKYYA1WYsPY0EBETDtH5AA
```
❌ Can't tell what this URL does without decoding

### After (v3) - Human-Readable Parameters
```
/playground#v=3&view=graphql&query=%7Bhello%7D&code=NobwRAdmBc...
```
✅ Can immediately see: version 3, GraphQL view, query is `{hello}`, code is compressed

## Real Examples

### Example 1: Simple Hello World Query
```
/playground#v=3&view=graphql&query=%7B+hello+%7D&code=NobwRAdmBcYM4GMAWBTAtgQwHQBc5gBowEYwBLNABwHsAnHAAgGVl0MAhAVzIBsATFLQYAzWtTQMA5AAEaOJNTgB6BHRSSA3AB0IO1RDiMARt36CGAXgYQUAd2atMXXgNoAKEAF8AlNt0QTF0EsAEdOQQBPABUIyhQPHQYRMhR%2BOGgGNxxvSwA%2BTJBEpIZUHh5qDJwsQ1oyCABzBIhi4toUOGoeADcUDLcci3zJAAlU8oIGAHU6fgBCSQIipJ9F5oYVnR8-HRQADxp6Bn1DBkRUTEsGQLNaXGoWc4x%2BjTBPAF0gA
```

**Human-readable parts:**
- `v=3` - Version 3 format
- `view=graphql` - GraphQL query view
- `query={ hello }` - The GraphQL query
- `code=<compressed>` - Schema code (compressed)

### Example 2: Query with Variables
```
/playground#v=3&view=graphql&query=query+GetUser%28%24id%3A+ID%21%29+%7B+user%28id%3A+%24id%29+%7B+name+email+%7D+%7D&vars=%7B%22id%22%3A+%22123%22%7D&code=NobwRAdmBcYM4GMAWBTAtgQwHQBc5gBowEZiB7COHAAkVU2oF5qtWwBfAXSA
```

**Human-readable parts:**
- `view=graphql` - GraphQL query view
- `query=query GetUser($id: ID!) { user(id: $id) { name email } }` - Full query
- `vars={"id": "123"}` - GraphQL variables
- `code=<compressed>` - Schema code

### Example 3: With Theme Settings
```
/playground#v=3&view=code&theme=dark&fontSize=16&code=<compressed>
```

**Human-readable parts:**
- `view=code` - Code editor view
- `theme=dark` - Dark theme
- `fontSize=16` - Font size 16px
- `code=<compressed>` - Schema code

## Benefits

### 1. **Debuggable URLs**
You can inspect URLs to see what query will run, what view mode is active, etc. without decoding anything.

### 2. **Shareable Queries**
When sharing a playground link, recipients can see the query in the URL before clicking.

### 3. **URL Manipulation**
You can manually edit parameters in the URL:
```
# Change view mode
?view=graphql → ?view=code

# Change query
&query={hello} → &query={users}

# Change theme
&theme=light → &theme=dark
```

### 4. **SEO & Analytics Friendly**
Analytics tools can parse the query, view mode, and other parameters without custom decoding.

### 5. **Efficient**
Only code is compressed - metadata is readable and still efficient:
- Simple query: ~350 chars
- With variables: ~200 chars
- Comparable to v2 format, but readable!

## URL Parameters Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `v` | string | Version (always "3") |
| `view` | `code` \| `graphql` | Active view mode |
| `query` | string | GraphQL query |
| `vars` | string | GraphQL variables (JSON) |
| `tab` | string | Active tab filename |
| `theme` | `light` \| `dark` \| `auto` | Editor theme |
| `fontSize` | number | Editor font size |
| `autoCompile` | boolean | Auto-compile enabled |
| `debounceMs` | number | Compile debounce delay |
| `code` | string | **Compressed** schema files |

## Backward Compatibility

All old URLs continue to work:

```
# v1 format (auto-migrates to v3)
/playground#N4IgJg9gxg...

# v2 format (auto-migrates to v3)
/playground#N4IgbiBcBMA0IDMo...

# Query parameters (legacy, still supported)
/playground?example=basic-types&embed=true
```

The playground automatically detects the format and handles it appropriately.

## Technical Details

### Encoding (v3)
```typescript
function encodePlaygroundState(state: PlaygroundURLState): string {
  const params = new URLSearchParams();

  params.set('v', '3');
  if (state.viewMode) params.set('view', state.viewMode);
  if (state.query) params.set('query', state.query);
  if (state.variables) params.set('vars', state.variables);

  // Compress only the files
  const filesJson = JSON.stringify(state.files);
  const compressed = compressToEncodedURIComponent(filesJson);
  params.set('code', compressed);

  return params.toString();
}
```

### Decoding (v3)
```typescript
function decodePlaygroundState(hash: string): PlaygroundURLState | null {
  const params = new URLSearchParams(hash);

  if (params.get('v') === '3') {
    // Parse readable params
    const viewMode = params.get('view');
    const query = params.get('query');
    const vars = params.get('vars');

    // Decompress only the code
    const code = params.get('code');
    const filesJson = decompressFromEncodedURIComponent(code);
    const files = JSON.parse(filesJson);

    return { files, viewMode, query, variables: vars };
  }

  // Fallback to v1/v2 format...
}
```

## Migration Notes

### For Users
No action needed - all old URLs automatically work!

### For Developers
The new format makes it easier to:
- Parse URLs in analytics
- Debug shared links
- Manually construct URLs
- Add new parameters without breaking old ones

## Testing

All tests passing:
```bash
✓ 10 URL state tests
✓ Backward compatibility tests
✓ Type checking
```

## See Also

- [URL_STATE_SPEC.md](website/lib/playground/URL_STATE_SPEC.md) - Full technical specification
- [url-state.ts](website/lib/playground/url-state.ts) - Implementation
- [url-state.test.ts](website/lib/playground/__tests__/url-state.test.ts) - Test suite
