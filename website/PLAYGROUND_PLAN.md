# Interactive Playground Feature Plan

## Vision

Build an interactive playground system for Pothos documentation that allows users to:
- View TypeScript source code with full type information
- See the generated GraphQL schema
- Execute queries against the schema using GraphiQL
- Edit code live (where supported)
- Share custom demos via URL

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Playground Component                         │
├──────────────────┬──────────────────┬───────────────────────────┤
│  Code Editor     │  Schema Viewer   │  GraphiQL                 │
│  (Monaco)        │  (Generated SDL) │  (Query Execution)        │
├──────────────────┴──────────────────┴───────────────────────────┤
│                     Execution Engine                             │
│  - TypeScript compilation (in-browser)                          │
│  - Pothos schema building                                       │
│  - GraphQL execution (graphql-js)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Static Playground Foundation

**Goal:** Create a basic playground component that renders pre-built examples with tabs for code, schema, and GraphiQL.

### Tasks

1. **Create Playground UI Component**
   - Three-panel layout (resizable): Code | Schema | GraphiQL
   - Tab navigation for mobile/compact view
   - Syntax highlighting for TypeScript and GraphQL

2. **Static Example Format**
   - Define a JSON/TS format for bundled examples:
     ```ts
     interface PlaygroundExample {
       id: string;
       title: string;
       description?: string;
       files: { filename: string; content: string }[];
       schema: string; // Pre-generated SDL
       defaultQuery?: string;
     }
     ```

3. **Pre-build Example Schemas**
   - Build script that compiles example TS → SDL at build time
   - Store compiled schemas alongside examples

4. **Integrate GraphiQL**
   - Already have `graphiql` as a dependency
   - Create executor that runs queries against the pre-built schema
   - Use `graphql-js` to execute queries in-browser

### Deliverables
- `<Playground />` component usable in MDX
- 2-3 demo examples (basic types, queries, mutations)
- Schema viewer with syntax highlighting

---

## Phase 2: Monaco Editor Integration

**Goal:** Add Monaco editor for proper TypeScript editing experience with type information.

### Tasks

1. **Monaco Editor Setup**
   - Install `@monaco-editor/react`
   - Configure TypeScript language service
   - Load Pothos type definitions into Monaco

2. **Type Definition Loading**
   - Bundle Pothos `.d.ts` files for browser
   - Include core + common plugin types
   - Create virtual file system for Monaco

3. **Multi-file Support**
   - Tab system for multiple files
   - File tree for complex examples
   - Import resolution between files

4. **Read-only Mode**
   - Initially, editor is read-only (viewing only)
   - Prepares foundation for Phase 3

### Deliverables
- Monaco-powered code viewer with IntelliSense
- Hover types visible in editor
- Multi-file example support

---

## Phase 3: Live Compilation

**Goal:** Enable live editing with real-time schema regeneration.

### Tasks

1. **In-Browser TypeScript Compilation**
   - Use `typescript` package in browser (or `@anthropic-ai/typescript-wasm` / `sucrase`)
   - Transpile TS → JS on edit
   - Handle import rewriting

2. **Pothos Browser Bundle**
   - Create browser-compatible Pothos bundle
   - Include core + selected plugins
   - Handle any Node.js-specific code

3. **Schema Regeneration**
   - Execute transpiled code in sandboxed context
   - Catch and display build errors
   - Extract schema SDL via `printSchema()`

4. **Debounced Updates**
   - Debounce compilation on keystroke
   - Show loading/compiling state
   - Display TypeScript and runtime errors inline

### Plugin Compatibility Matrix

| Plugin | Browser Support | Notes |
|--------|----------------|-------|
| core | ✅ | Full support |
| relay | ✅ | Full support |
| errors | ✅ | Full support |
| validation (zod) | ✅ | Zod works in browser |
| scope-auth | ✅ | Full support |
| simple-objects | ✅ | Full support |
| directives | ✅ | Full support |
| prisma | ❌ | Requires Prisma Client |
| drizzle | ❌ | Requires DB connection |
| dataloader | ⚠️ | Works but less useful |

### Deliverables
- Live TypeScript → Schema compilation
- Error display in editor
- Working demos for supported plugins

---

## Phase 4: Shareable Demos

**Goal:** Allow users to create and share playground links.

### Tasks

1. **URL State Encoding**
   - Encode playground state in URL hash
   - Compress code with `lz-string` or similar
   - Handle large examples gracefully

2. **Share Button**
   - Copy shareable URL to clipboard
   - Optional: Short URL service integration

3. **Import from URL**
   - Parse URL on page load
   - Restore editor state from URL
   - Handle version compatibility

4. **Standalone Playground Page**
   - `/playground` route for blank playground
   - Start from template or scratch
   - Full-page layout option

### Deliverables
- Share button on every playground
- `/playground` standalone page
- URL-based demo sharing

---

## Phase 5: Docs Integration

**Goal:** Make all code snippets in docs expandable into interactive playgrounds.

### Tasks

1. **Code Block Enhancement**
   - Add "Open in Playground" button to code blocks
   - Detect Pothos code patterns
   - Link to pre-configured playground

2. **Inline Expansion**
   - Expand code block into inline playground
   - Collapse back to code block
   - Preserve scroll position

3. **Example Extraction**
   - Tooling to extract examples from docs
   - Ensure examples compile
   - Auto-generate complete examples from snippets

4. **MDX Components**
   ```mdx
   <CodeBlock playground>
   {`const builder = new SchemaBuilder({});`}
   </CodeBlock>
   
   <!-- or -->
   
   <Playground example="relay-connection" />
   ```

### Deliverables
- Enhanced code blocks throughout docs
- Inline playground expansion
- Curated example library

---

## Phase 6: Advanced Features

**Goal:** Polish and advanced functionality.

### Tasks

1. **Multiple Query Tabs in GraphiQL**
   - Save multiple queries per example
   - Query history

2. **Example Categories**
   - Browse examples by plugin/concept
   - Search examples
   - Difficulty levels

3. **Performance Optimization**
   - Lazy load Monaco and dependencies
   - Web Worker for compilation
   - Caching compiled schemas

4. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - High contrast themes

5. **Analytics**
   - Track popular examples
   - Error patterns
   - Usage metrics

---

## Technical Decisions

### Editor Choice: Monaco
- Best TypeScript support
- VSCode-like experience
- Hover types and IntelliSense
- Alternatives considered: CodeMirror 6 (lighter but less TS support)

### Compilation Strategy
- Primary: `typescript` in browser via Web Worker
- Fallback: `sucrase` for faster but less complete compilation
- Schema building happens in main thread (simpler, Pothos is fast)

### State Management
- URL hash for shareability
- Local storage for preferences
- React state for runtime

### Styling
- Use existing Tailwind setup
- Match Fumadocs theme
- Dark/light mode support

---

## File Structure

```
website/
├── components/
│   └── playground/
│       ├── Playground.tsx           # Main component
│       ├── CodeEditor.tsx           # Monaco wrapper
│       ├── SchemaViewer.tsx         # SDL display
│       ├── GraphiQLPanel.tsx        # GraphiQL wrapper
│       ├── ExecutionEngine.ts       # TS compilation + execution
│       ├── types.ts                 # Shared types
│       └── examples/                # Bundled examples
│           ├── index.ts
│           ├── basic-types.ts
│           └── ...
├── lib/
│   └── playground/
│       ├── compiler.worker.ts       # Web Worker for compilation
│       ├── pothos-bundle.ts         # Browser Pothos bundle
│       └── type-definitions/        # .d.ts files for Monaco
└── app/
    └── playground/
        └── page.tsx                 # Standalone playground page
```

---

## Getting Started (Phase 1)

### Immediate Next Steps

1. Create `components/playground/` directory structure
2. Build basic `<Playground />` component with static content
3. Create 1-2 example schemas (pre-built)
4. Integrate GraphiQL with in-browser execution
5. Add to a test doc page

### Dependencies to Add

```bash
pnpm add @monaco-editor/react lz-string
# graphiql and graphql already installed
```

---

## Open Questions

1. **Persistence**: Should users be able to save examples to their account?
2. **Versioning**: How to handle Pothos version differences in examples?
3. **Server Execution**: Any examples that need server-side execution?
4. **Testing**: How to test playground examples in CI?

---

## Success Metrics

- Examples load in < 2s
- TypeScript types visible on hover
- Schema regeneration < 500ms
- All core plugin examples work
- Shareable links work reliably
