---
"@pothos/plugin-drizzle": minor
---

Add pathInfo parameter to t.relation() and t.relatedConnection() query callbacks for path-based filtering.

PathInfo includes:
- `path`: Array of "ParentType.fieldName" strings (e.g., `['Query.user', 'User.posts']`)
- `segments`: Detailed info for each path segment including field, alias, parentType, and isList

Example usage:
```typescript
postsForModeration: t.relation('posts', {
  query: (args, ctx, pathInfo) => {
    // Check if we're a direct child of pendingReviewAuthor
    const isReviewContext = pathInfo?.path?.at(-2) === 'Query.pendingReviewAuthor';
    return {
      where: { published: isReviewContext ? 0 : 1 },
    };
  },
})
```
