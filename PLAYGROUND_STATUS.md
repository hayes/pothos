# Pothos Playground - Status & Roadmap

## Current Status (December 2025)

### Completed ✅

The interactive playground is **fully functional** with the following features:

#### 1. Main Playground Page (`/playground`)
- **Split-view interface**: Code editor on left, panels on right
- **View switching**: Toggle between TypeScript editor and GraphQL query panel
- **Right panel tabs**: Schema viewer, Documentation, Examples browser
- **URL state management**: Share playground state via URL parameters
- **Responsive design**: Works on desktop and tablet

#### 2. Monaco Editor Integration
- **Full TypeScript support** with syntax highlighting and IntelliSense
- **Bundled Pothos types**: 56 type definitions loaded from `@pothos/core`
- **Real-time type checking**: Errors and warnings displayed inline
- **Auto-completion**: Full autocomplete for Pothos APIs

#### 3. Schema Compilation
- **Live compilation**: TypeScript → JavaScript → GraphQL Schema
- **In-browser execution**: Uses `esbuild-wasm` for compilation
- **Error handling**: Compilation errors displayed with clear messages
- **Success indicator**: Visual feedback when schema compiles successfully

#### 4. GraphiQL Integration
- **Interactive query execution**: Test compiled schemas with GraphiQL
- **GraphQL Explorer plugin**: Browse schema documentation
- **Query/mutation testing**: Execute queries against live schema

#### 5. Examples System
Five working examples demonstrating Pothos features:
- `basic-types` - Basic object types, fields, queries
- `mutations` - Defining mutations and arguments
- `interfaces` - Interface types and implementations
- `enums-args` - Enums and argument types
- `unions` - Union types and type resolution

#### 6. Documentation Integration
- **`<PlaygroundEmbed />` component**: Embed examples in MDX documentation
- **Used in**: `content/docs/guide/playground.mdx`

#### 7. Testing Infrastructure
- **Playwright E2E tests**: 9 comprehensive tests covering all major features
- **100% pass rate**: All tests passing consistently
- **Debug tools**: Screenshot and console capture for troubleshooting

#### 8. Clean Architecture
- **3 active components**: GraphQLEditor, PlaygroundEmbed, examples
- **6 library files**: Execution engine, type bundling, compiler hook, Monaco setup, URL state
- **No dead code**: Cleanup phase removed ~1,554 lines of unused components

### Technical Architecture

```
website/
├── app/playground/page.tsx              # Main playground page
├── components/playground/
│   ├── GraphQLEditor.tsx                # GraphiQL wrapper component
│   ├── PlaygroundEmbed.tsx              # MDX embed component
│   ├── examples/                        # Example schema definitions
│   │   ├── basic-types.ts
│   │   ├── mutations.ts
│   │   ├── interfaces.ts
│   │   ├── enums-args.ts
│   │   └── unions.ts
│   ├── types.ts                         # Shared TypeScript types
│   └── index.ts                         # Public exports
└── lib/playground/
    ├── execution-engine.ts              # TypeScript→JS with esbuild-wasm
    ├── pothos-bundle.ts                 # Browser-compatible Pothos runtime
    ├── pothos-types.ts                  # Bundled type definitions (56 defs)
    ├── setup-monaco.ts                  # Monaco editor configuration
    ├── url-state.ts                     # URL serialization/deserialization
    └── use-playground-compiler.ts       # React hook for schema compilation
```

### Key Technical Decisions

1. **Bundled Types + Local Runtime**: Both Monaco types and runtime use the same local Pothos bundle to avoid TypeScript unique symbol conflicts
2. **esbuild-wasm**: In-browser TypeScript compilation without server dependency
3. **URL State**: Playground state encoded in URL for shareability
4. **GraphiQL Integration**: Reusing `@graphiql/react` for consistent GraphQL IDE experience

---

## Remaining Work

### Priority 0: Bug Fixes 🐛 **URGENT**

Critical issues that need immediate attention:

**1. Variables Panel Toggle Error**
- **Issue**: Toggling the variables window multiple times causes errors
- **Location**: `GraphQLEditor.tsx` - variables panel show/hide logic
- **Impact**: Console errors, potential state corruption
- **Priority**: High - affects core functionality

**2. Next.js Navigation Errors**
- **Issue**: Errors logged when navigating around the playground
- **Location**: Likely in routing/state management
- **Impact**: Console pollution, potential memory leaks
- **Priority**: Medium - doesn't block functionality but indicates issues

**Tasks**:
- [ ] Investigate and fix variables panel toggle errors
- [ ] Debug Next.js navigation warnings/errors
- [ ] Add error boundaries to prevent crashes
- [ ] Review React state management for race conditions

---

### Priority 1: Code Editor Toolbar Enhancements 🎯 **NEW**

**Problem**: The Monaco code editor lacks helpful utilities that are present in the GraphiQL query builder, such as format/prettify and copy buttons.

**Current State**:
- GraphiQL has: Execute button, Prettify button (Sparkles icon), Copy query button
- Monaco editor has: No toolbar, no utility buttons

**Solution**: Add a floating toolbar to the Monaco editor similar to GraphiQL's toolbar.

#### Implementation Plan

**Toolbar Features**:
- [ ] **Copy Code button**: Copy current editor content to clipboard
- [ ] **Format/Prettify button**: Format TypeScript code using Monaco's built-in formatter
- [ ] **Reset to Default button**: Reset to the default example code (optional)
- [ ] Consistent styling with GraphiQL toolbar (floating, semi-transparent background)

**Design Considerations**:
- Position: Top-right corner of Monaco editor (similar to GraphiQL)
- Style: Match GraphiQL's toolbar styling with icon buttons
- Icons: Use lucide-react icons for consistency (Copy, Sparkles)
- Keyboard shortcuts: Cmd/Ctrl+K → Format, Cmd/Ctrl+Shift+C → Copy

**File Changes**:
- Edit `website/app/playground/page.tsx`:
  - Add toolbar component inside SourceEditor div
  - Implement copy to clipboard function (reuse existing `copyToClipboard` utility)
  - Implement format action using Monaco's `editor.getAction('editor.action.formatDocument').run()`
  - Add visual feedback for copy action (checkmark icon temporarily)

**Implementation Details**:
```tsx
// Toolbar positioned absolutely over Monaco editor
<div className="absolute top-2 right-2 z-10 flex gap-1 rounded bg-fd-background/80 p-1 shadow-lg backdrop-blur">
  <button
    onClick={handleFormatCode}
    title="Format code (Shift-Alt-F)"
    className="rounded p-1.5 hover:bg-fd-accent transition-colors"
  >
    <Sparkles size={16} />
  </button>
  <button
    onClick={handleCopyCode}
    title="Copy code"
    className="rounded p-1.5 hover:bg-fd-accent transition-colors"
  >
    {copied ? <Check size={16} /> : <Copy size={16} />}
  </button>
</div>
```

---

### Priority 2: Code Snippet Component 🎯 **NEW**

**Problem**: The full playground is too heavy for inline documentation, especially on mobile devices. Loading Monaco editor, esbuild-wasm, and GraphiQL adds significant bundle size and initialization time.

**Solution**: Create a lightweight code snippet component for documentation that can optionally expand to the full playground.

#### Design Options

##### Option A: Modal Popup
```tsx
<CodeSnippet example="basic-types" expandable>
  {`const builder = new SchemaBuilder({});`}
</CodeSnippet>
```
- Click "Open in Playground" → Modal overlay with full playground
- Pros: Stays on same page, no navigation
- Cons: Modal UX can feel cramped, especially for complex examples

##### Option B: New Window/Tab
```tsx
<CodeSnippet example="basic-types" expandable>
  {`const builder = new SchemaBuilder({});`}
</CodeSnippet>
```
- Click "Open in Playground" → Opens `/playground?example=basic-types` in new tab
- Pros: Full screen space, can keep docs open side-by-side
- Cons: Tab management, potential popup blockers

##### Option C: Iframe Popup (Recommended)
```tsx
<CodeSnippet example="basic-types" expandable>
  {`const builder = new SchemaBuilder({});`}
</CodeSnippet>
```
- Initial render: Static syntax-highlighted code (using `shiki` or `prism`)
- Click "Open in Playground" → Iframe overlay with `/playground?example=basic-types&embed=true`
- Pros:
  - Zero playground JS loaded until user clicks
  - Full playground features available
  - Isolated context (no style conflicts)
  - Easy to implement with existing playground
- Cons:
  - Iframe can be clunky on mobile
  - Cross-origin restrictions (shouldn't be an issue for same-domain)

#### Implementation Plan

**Phase 1: Lightweight CodeSnippet Component**
- [ ] Create `<CodeSnippet />` component with syntax highlighting only
- [ ] Add "Open in Playground" button
- [ ] Support inline code or reference to example by ID
- [ ] Match existing documentation styling

**Phase 2: Expand Mechanism**
- [ ] Add `?embed=true` mode to playground page (minimal chrome, no header/footer)
- [ ] Create iframe overlay component with close button
- [ ] Pass code/example state via URL parameters
- [ ] Handle responsive sizing (80% width on desktop, full screen on mobile)

**Phase 3: Documentation Integration**
- [ ] Replace heavy `<PlaygroundEmbed />` with `<CodeSnippet expandable />`
- [ ] Add expand buttons to existing code blocks in docs
- [ ] Create example registry for referenced snippets
- [ ] Add "Copy Code" button alongside "Open in Playground"

**Phase 4: Performance Optimization**
- [ ] Ensure zero playground bundle loaded for non-expanded snippets
- [ ] Lazy load iframe only when user clicks expand
- [ ] Add loading state during playground initialization

#### File Structure
```
website/
├── components/
│   ├── code-snippet/
│   │   ├── CodeSnippet.tsx          # Main lightweight component
│   │   ├── PlaygroundOverlay.tsx    # Iframe wrapper component
│   │   └── syntax-themes.ts         # Syntax highlighting config
│   └── playground/
│       └── ...                       # Existing playground files
└── lib/
    └── code-snippet/
        ├── example-registry.ts       # Centralized example lookup
        └── syntax-highlighter.ts     # Shiki/Prism wrapper
```

---

### Priority 3: Example Gallery

Expand the examples system with more real-world patterns:

**New Examples Needed**:
- [ ] `relay-connections` - Relay-style pagination
- [ ] `validation` - Zod/Yup validation plugin
- [ ] `auth-scopes` - Scope-based authorization
- [ ] `errors-plugin` - Error handling patterns
- [ ] `simple-objects` - SimpleObjects plugin
- [ ] `directives` - Custom GraphQL directives
- [ ] `subscriptions` - GraphQL subscriptions (mock)
- [ ] `dataloader` - DataLoader pattern (mock data)
- [ ] `federation` - Basic federation setup
- [ ] `complex-types` - Nested types, circular refs

**Gallery UI**:
- [ ] Grid view of example cards with screenshots/descriptions
- [ ] Category filtering (Core, Plugins, Patterns, Advanced)
- [ ] Search by keyword
- [ ] Difficulty indicators (Beginner, Intermediate, Advanced)
- [ ] Tags for features (e.g., "Authentication", "Pagination", "Validation")

---

### Priority 4: Enhanced Mobile Experience

The current playground works on tablets but needs optimization for phones:

- [ ] Collapsible panels for small screens
- [ ] Swipe gestures between views
- [ ] Simplified toolbar with hamburger menu
- [ ] Virtual keyboard handling for editor
- [ ] Touch-optimized GraphiQL controls

---

### Priority 5: Performance Optimization

Current performance is good but can be improved:

- [ ] **Web Worker compilation**: Move esbuild to Web Worker to avoid blocking main thread
- [ ] **Lazy load Monaco**: Only load editor when playground is visible
- [ ] **Schema caching**: Cache compiled schemas in IndexedDB
- [ ] **Bundle splitting**: Separate GraphiQL from core playground bundle
- [ ] **Debounce optimization**: Tune debounce timing based on code size

**Target Metrics**:
- Initial playground load: < 2s (currently ~3-4s)
- Schema compilation: < 500ms (currently ~1-2s)
- Code snippet (no expand): < 100ms

---

### Priority 6: Advanced Features

Nice-to-have enhancements:

- [ ] **Multi-file support**: Examples with multiple TypeScript files
- [ ] **Query tabs**: Save multiple queries per example
- [ ] **Query history**: Persist recent queries in local storage
- [ ] **Dark mode toggle**: Separate from system preference
- [ ] **Export schema**: Download SDL or TypeScript code
- [ ] **Permalink button**: Quick copy shareable URL
- [ ] **Embed mode**: `?embed=true` for iframes (needed for CodeSnippet)
- [ ] **Version selector**: Switch Pothos versions (complex - may not be worth it)

---

### Priority 7: Testing & Quality

- [ ] **Visual regression tests**: Screenshot comparison for playground UI
- [ ] **Example smoke tests**: Ensure all examples compile successfully
- [ ] **Bundle size monitoring**: Alert on size increases
- [ ] **Error boundary**: Graceful handling of playground crashes
- [ ] **Analytics**: Track example views and errors (privacy-conscious)

---

## Known Issues

### Bugs
1. **Variables panel toggle**: Multiple rapid toggles cause errors
2. **Next.js navigation**: Console errors when navigating in playground
3. **Missing editor toolbar**: No format/copy buttons in Monaco editor

### Limitations
1. **Prisma/Drizzle plugins**: Cannot demo database-dependent plugins in browser
2. **Node.js APIs**: Any plugin using Node.js-specific APIs won't work
3. **Large schemas**: Very large schemas (>1000 lines) may be slow to compile
4. **Mobile keyboard**: Monaco editor UX is challenging on phones
5. **Old browsers**: Requires modern browser with WebAssembly support

---

## Success Metrics

### Current
- ✅ Playground loads and compiles schemas
- ✅ All 9 E2E tests passing
- ✅ 5 working examples
- ✅ URL sharing works

### Target (After Remaining Work)
- Code snippet component used in 50+ places in docs
- 15+ working examples covering all browser-compatible plugins
- < 2s playground initial load
- < 100ms code snippet render (no expansion)
- Mobile-friendly experience on phones
- 100% test coverage for examples

---

## Next Steps

**Immediate Priorities** (in order):

1. **Bug Fixes** (4-6 hours) - **URGENT**
   - Fix variables panel toggle errors
   - Investigate and fix Next.js navigation errors
   - Add error boundaries for resilience

2. **Code Editor Toolbar** (2-4 hours) - **Quick Win**
   - Add format and copy buttons to Monaco editor
   - Match GraphiQL's toolbar UX
   - Improve developer experience in playground

3. **Code Snippet Component** (1-2 days)
   - Implement lightweight component for docs
   - Add iframe expansion mechanism
   - Unblock better documentation integration

**Estimated Timeline**:
- Bug fixes: 4-6 hours (urgent)
- Code editor toolbar: 2-4 hours (quick win)
- Code snippet component: 1-2 days
- Example gallery expansion: 2-3 days
- Mobile optimization: 2-3 days
- Performance tuning: 1-2 days
- Advanced features: Ongoing

**Recommendation**:
1. **Start with bug fixes** - resolve variables toggle and navigation errors first
2. **Add editor toolbar** - quick UX improvement for current playground users
3. **Build Code Snippet component** - enables better docs integration
4. The full playground works well aside from bugs - priorities are bug fixes, polish, and documentation embeds
