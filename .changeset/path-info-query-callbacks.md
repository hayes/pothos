---
"@pothos/plugin-drizzle": minor
---

Add pathInfo parameter to t.relation() and t.relatedConnection() query callbacks for path-based filtering.

PathInfo includes:
- `path`: Array of "ParentType.fieldName" strings (e.g., `['Query.user', 'User.posts']`)
- `segments`: Detailed info for each path segment including field, alias, parentType, and isList

Example usage:
```typescript
posts: t.relation('posts', {
  query: (args, ctx, pathInfo) => {
    // Check if accessed via viewer (own profile) vs user (public)
    const isViewerContext = pathInfo?.path?.at(-2) === 'Query.viewer';
    return {
      where: { published: isViewerContext ? false : true },
    };
  },
})
```
