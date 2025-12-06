# Playground Code Review - Fix Implementation Plan

**Created**: 2025-12-05
**Status**: Planning Phase
**Estimated Effort**: 3-5 days

---

## Overview

This document outlines the implementation plan to address issues identified in the comprehensive code review of the Pothos Playground. Issues are organized by priority and estimated complexity.

---

## Phase 1: Critical Security & Safety Fixes (Priority 1) 🔴

**Estimated Time**: 1 day
**Risk Level**: High - Must be completed before production deployment

### 1.1 Fix Unsafe Code Execution
**File**: `website/lib/playground/execution-engine.ts`
**Lines**: 129-185
**Issue**: Using `new Function()` without timeout or memory limits

**Implementation Steps**:
1. Create `executeWithTimeout` utility function
2. Add execution timeout (5 seconds default)
3. Add try-catch with proper error messages
4. Document security limitations in comments
5. Consider adding CSP headers in Next.js config

**Code Changes**:
```typescript
// New utility in execution-engine.ts
interface ExecutionOptions {
  timeoutMs?: number;
  memoryLimitMB?: number;
}

function executeWithTimeout<T>(
  fn: () => T,
  options: ExecutionOptions = {}
): T {
  const timeoutMs = options.timeoutMs ?? 5000;
  let completed = false;
  let result: T;
  let error: Error | null = null;

  const timer = setTimeout(() => {
    if (!completed) {
      error = new Error(`Execution timeout after ${timeoutMs}ms`);
    }
  }, timeoutMs);

  try {
    result = fn();
    completed = true;
    clearTimeout(timer);

    if (error) throw error;
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw error || err;
  }
}

// Update executeAndBuildSchema to use timeout
export function executeAndBuildSchema(
  compiledCode: string,
  modules: PlaygroundModules,
  additionalModules: Record<string, unknown> = {},
): ExecutionResult {
  try {
    const { result, logs } = captureConsole(() => {
      return executeWithTimeout(() => {
        // ... existing execution code
      }, { timeoutMs: 5000 });
    });
    // ... rest of function
  } catch (err) {
    if (err instanceof Error && err.message.includes('timeout')) {
      return {
        success: false,
        error: 'Execution timeout: Your code took too long to run. Check for infinite loops.',
        consoleLogs: [],
      };
    }
    // ... handle other errors
  }
}
```

**Testing**:
- [ ] Test with infinite loop code
- [ ] Test with very slow recursive functions
- [ ] Test with valid code to ensure no false positives
- [ ] Add E2E test for timeout handling

---

### 1.2 Fix Console Capture Race Condition
**File**: `website/app/playground/page.tsx`
**Lines**: 107-133
**Issue**: Schema ref could become null between check and use

**Implementation Steps**:
1. Capture schema ref before check
2. Use captured value in execution
3. Add null safety comments

**Code Changes**:
```typescript
function createFetcher(
  schemaRef: { current: GraphQLSchema | null },
  onConsoleLogs: (logs: Array<{ type: 'log' | 'warn' | 'error' | 'info'; args: unknown[] }>) => void,
): Fetcher {
  return async ({ query, variables, operationName }) => {
    // Capture schema reference to prevent race conditions
    const schema = schemaRef.current;

    if (!schema) {
      return { errors: [new GraphQLError('Schema not ready')] };
    }

    // Use captured schema reference (no longer nullable)
    const { result, logs } = await captureConsoleAsync(async () => {
      return await graphql({
        schema, // Now guaranteed to be non-null
        source: query,
        variableValues: variables,
        operationName,
      });
    });

    if (logs.length > 0) {
      onConsoleLogs(logs);
    }

    return result;
  };
}
```

**Testing**:
- [ ] Test rapid schema changes during query execution
- [ ] Add stress test with concurrent queries
- [ ] Verify no null reference errors in console

---

### 1.3 Improve Clipboard Handling
**File**: `website/lib/playground/url-state.ts`
**Lines**: 272-292
**Issue**: Silent failures, deprecated API, poor error handling

**Implementation Steps**:
1. Return detailed error information
2. Add logging for debugging
3. Improve fallback reliability
4. Update callers to handle error responses

**Code Changes**:
```typescript
export interface ClipboardResult {
  success: boolean;
  error?: string;
}

export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  // Try modern Clipboard API first
  try {
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (err) {
    console.warn('[Clipboard] Modern API failed:', err);

    // Fallback to execCommand (deprecated but widely supported)
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position: fixed; opacity: 0; pointer-events: none; left: -9999px;';
      document.body.appendChild(textarea);

      textarea.select();
      textarea.setSelectionRange(0, text.length);

      const success = document.execCommand('copy');

      return success
        ? { success: true }
        : { success: false, error: 'Copy command failed' };
    } catch (fallbackErr) {
      console.error('[Clipboard] Fallback failed:', fallbackErr);
      return {
        success: false,
        error: 'Clipboard access denied. Please copy the URL manually.'
      };
    } finally {
      if (textarea?.parentNode) {
        document.body.removeChild(textarea);
      }
    }
  }
}
```

**Update Callers**:
```typescript
// In page.tsx handleShare
const handleShare = useCallback(async () => {
  try {
    const url = createShareableURL({...});
    const result = await copyToClipboard(url);

    if (result.success) {
      setShareStatus('copied');
    } else {
      setShareStatus('error');
      console.error('[Share] Failed to copy:', result.error);
      // Optionally show error message to user
    }
  } catch (err) {
    setShareStatus('error');
    console.error('[Share] Unexpected error:', err);
  }
  setTimeout(() => setShareStatus('idle'), 2000);
}, [files, viewMode, currentQuery, currentVariables]);
```

**Testing**:
- [ ] Test in browsers with clipboard permissions denied
- [ ] Test in private/incognito mode
- [ ] Test with very long URLs
- [ ] Test on mobile browsers

---

## Phase 2: High Priority Correctness Fixes (Priority 2) 🟠

**Estimated Time**: 1.5 days
**Risk Level**: Medium - Affects user experience and data integrity

### 2.1 Fix Schema Hashing Algorithm
**File**: `website/app/playground/page.tsx`
**Lines**: 431-444
**Issue**: Poor hash distribution, misleading comment, inefficient

**Implementation Steps**:
1. Implement proper djb2 hash function
2. Move to utility file for reuse
3. Add JSDoc explaining purpose
4. Update comment about 32-bit conversion

**Code Changes**:
```typescript
// New file: website/lib/playground/hash-utils.ts
/**
 * DJB2 hash algorithm - simple, fast, and good distribution
 * Used for generating schema cache keys
 *
 * @param str - String to hash
 * @returns Hash as base-36 string (alphanumeric)
 */
export function hashString(str: string): string {
  let hash = 5381; // DJB2 initial value

  for (let i = 0; i < str.length; i++) {
    // hash * 33 ^ char
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }

  // Convert to unsigned 32-bit integer, then to base-36 string
  return (hash >>> 0).toString(36);
}

/**
 * Generate a cache key for a schema SDL string
 */
export function generateSchemaKey(schemaSDL: string | null): string {
  if (!schemaSDL) {
    return 'none';
  }
  return `schema-${hashString(schemaSDL)}`;
}
```

**Update page.tsx**:
```typescript
import { generateSchemaKey } from '../../lib/playground/hash-utils';

// Replace existing schemaKey useMemo
const schemaKey = useMemo(() => {
  return generateSchemaKey(compilerState.schemaSDL);
}, [compilerState.schemaSDL]);
```

**Testing**:
- [ ] Verify no collisions in test suite
- [ ] Benchmark performance vs old algorithm
- [ ] Test with very large schemas
- [ ] Verify localStorage keys are stable across reloads

---

### 2.2 Fix localStorage Clearing
**File**: `website/app/playground/page.tsx`
**Lines**: 447-455
**Issue**: Clears ALL GraphiQL data, destroys user preferences

**Implementation Steps**:
1. Track previous schema key
2. Only clear data for old schema
3. Preserve user settings/preferences
4. Add comments explaining behavior

**Code Changes**:
```typescript
// Track previous schema key to clean up old data
const prevSchemaKeyRef = useRef<string>('none');

// Clear GraphiQL localStorage for previous schema when schema changes
useEffect(() => {
  if (schemaKey !== 'none' && prevSchemaKeyRef.current !== schemaKey) {
    const prevKey = prevSchemaKeyRef.current;

    // Only clear localStorage entries for the previous schema
    // This preserves user settings while cleaning up old tabs/history
    if (prevKey !== 'none') {
      const keysToRemove: string[] = [];

      // Find all keys belonging to the previous schema
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`graphiql:${prevKey}:`)) {
          keysToRemove.push(key);
        }
      }

      // Remove old schema's data
      keysToRemove.forEach(key => localStorage.removeItem(key));

      if (keysToRemove.length > 0) {
        console.log(`[Playground] Cleaned up ${keysToRemove.length} localStorage entries for previous schema`);
      }
    }

    prevSchemaKeyRef.current = schemaKey;
  }
}, [schemaKey]);
```

**Alternative Approach** (More aggressive but simpler):
```typescript
// Option B: Clear all GraphiQL state when schema changes
// This is simpler but loses user's query history
useEffect(() => {
  if (schemaKey !== 'none' && prevSchemaKeyRef.current !== 'none'
      && prevSchemaKeyRef.current !== schemaKey) {

    // Clear all GraphiQL localStorage (tabs, history, but not settings)
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Preserve settings, only clear tabs and history
      if (key?.startsWith('graphiql:') &&
          !key.includes(':settings') &&
          !key.includes(':preferences')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    prevSchemaKeyRef.current = schemaKey;
  }
}, [schemaKey]);
```

**Testing**:
- [ ] Test schema changes preserve user settings
- [ ] Test multiple rapid schema changes
- [ ] Test with example loading
- [ ] Verify no localStorage leaks over time

---

### 2.3 Replace Regex Import Rewriting
**File**: `website/lib/playground/execution-engine.ts`
**Lines**: 187-257
**Issue**: Fragile regex parsing, fails on edge cases

**Implementation Steps**:
1. Evaluate using TypeScript compiler API vs Babel
2. Implement AST-based transformation
3. Add comprehensive test cases
4. Handle all import types (named, default, namespace, side-effect)

**Decision**: Use TypeScript compiler API (already in dependencies)

**Code Changes**:
```typescript
import * as ts from 'typescript';

/**
 * Rewrite ES6 imports to CommonJS-style requires using TypeScript AST
 * This is more reliable than regex-based parsing
 */
function rewriteImportsWithAST(code: string): string {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const transformedStatements: string[] = [];

  sourceFile.statements.forEach(statement => {
    if (ts.isImportDeclaration(statement)) {
      // Transform import to require
      transformedStatements.push(transformImportDeclaration(statement));
    } else if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) {
      // Transform export
      transformedStatements.push(transformExportDeclaration(statement));
    } else {
      // Keep other statements as-is
      const printer = ts.createPrinter();
      transformedStatements.push(printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile));
    }
  });

  return transformedStatements.join('\n');
}

function transformImportDeclaration(node: ts.ImportDeclaration): string {
  const moduleName = (node.moduleSpecifier as ts.StringLiteral).text;
  const clause = node.importClause;

  if (!clause) {
    // Side-effect import: import './style.css'
    return `__require('${moduleName}');`;
  }

  const parts: string[] = [];

  // Default import: import Foo from 'module'
  if (clause.name) {
    parts.push(`const ${clause.name.text} = __require('${moduleName}').default || __require('${moduleName}');`);
  }

  // Named imports: import { a, b as c } from 'module'
  if (clause.namedBindings) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      // import * as foo from 'module'
      const name = clause.namedBindings.name.text;
      parts.push(`const ${name} = __require('${moduleName}');`);
    } else if (ts.isNamedImports(clause.namedBindings)) {
      // import { a, b } from 'module'
      const imports = clause.namedBindings.elements
        .map(el => {
          const name = el.name.text;
          const propertyName = el.propertyName?.text || name;
          return name === propertyName ? name : `${propertyName}: ${name}`;
        })
        .join(', ');
      parts.push(`const { ${imports} } = __require('${moduleName}');`);
    }
  }

  return parts.join('\n');
}

function transformExportDeclaration(node: ts.Node): string {
  // Handle: export const foo = ...
  // Handle: export { foo }
  // Handle: export default ...
  // Implementation details...
  return ''; // TODO: Complete implementation
}
```

**Note**: This is complex. Consider **alternative simpler approach**:
```typescript
// Alternative: Keep regex but add comprehensive tests and fixes
function rewriteImports(code: string): string {
  let rewritten = code;

  // Handle multiline imports by normalizing first
  rewritten = rewritten.replace(/import\s+([^;]+?)\s+from\s+(['"][^'"]+['"])/gs,
    'import $1 from $2');

  // Now apply single-line transformations
  // ... rest of implementation with better regex patterns
}
```

**Recommendation**: Start with improved regex + tests, migrate to AST later if needed.

**Testing**:
- [ ] Test default imports
- [ ] Test named imports
- [ ] Test namespace imports (`import * as`)
- [ ] Test side-effect imports
- [ ] Test multiline imports
- [ ] Test dynamic imports
- [ ] Add unit tests with 20+ edge cases

---

### 2.4 Fix Debounce Race Conditions
**File**: `website/lib/playground/use-playground-compiler.ts`
**Lines**: 122-160
**Issue**: Timer not cleaned up, multiple compilations possible

**Implementation Steps**:
1. Add cleanup in useEffect return
2. Add cancellation for in-flight compilations
3. Add ref to track current compilation
4. Add tests for rapid changes

**Code Changes**:
```typescript
export function usePlaygroundCompiler({
  files,
  debounceMs = 500,
  autoCompile = true,
}: UsePlaygroundCompilerOptions): UsePlaygroundCompilerResult {
  const [state, setState] = useState<CompilerState>({
    isCompiling: true,
    schema: null,
    schemaSDL: null,
    error: null,
    lastCompiledAt: null,
    consoleLogs: [],
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const prevFilesRef = useRef(files);
  const currentCompilationRef = useRef<number>(0); // Track compilation version

  const compile = useCallback(async () => {
    const mainFile = files.find((f) => f.filename === 'schema.ts') || files[0];
    if (!mainFile) {
      setState((prev) => ({
        ...prev,
        error: 'No schema file found',
        isCompiling: false,
      }));
      return;
    }

    // Increment compilation version
    const compilationId = ++currentCompilationRef.current;

    setState((prev) => ({ ...prev, isCompiling: true, error: null }));

    try {
      const result: ExecutionResult = await compileAndExecute(
        mainFile.content,
        modules,
        mainFile.filename,
      );

      // Only update state if this is still the latest compilation
      if (compilationId === currentCompilationRef.current) {
        if (result.success && result.schema && result.schemaSDL) {
          setState({
            isCompiling: false,
            schema: result.schema,
            schemaSDL: result.schemaSDL,
            error: null,
            lastCompiledAt: Date.now(),
            consoleLogs: result.consoleLogs || [],
          });
        } else {
          setState((prev) => ({
            ...prev,
            isCompiling: false,
            error: result.error || 'Unknown compilation error',
            consoleLogs: result.consoleLogs || [],
          }));
        }
      }
    } catch (err) {
      // Only update if still latest
      if (compilationId === currentCompilationRef.current) {
        const error = err as Error;
        setState((prev) => ({
          ...prev,
          isCompiling: false,
          error: error.message,
        }));
      }
    }
  }, [files]);

  const reset = useCallback(() => {
    setState({
      isCompiling: true,
      schema: null,
      schemaSDL: null,
      error: null,
      lastCompiledAt: null,
      consoleLogs: [],
    });
  }, []);

  useEffect(() => {
    // Handle first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (autoCompile) {
        void compile();
      }
      return;
    }

    // Skip if auto-compile disabled or files unchanged
    if (!autoCompile || prevFilesRef.current === files) {
      return;
    }

    prevFilesRef.current = files;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set pending state immediately
    setState((prev) => ({ ...prev, isCompiling: true }));

    // Start new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      void compile();
    }, debounceMs);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [files, debounceMs, autoCompile, compile]);

  return { state, compile, reset };
}
```

**Testing**:
- [ ] Test rapid typing (many changes in debounce window)
- [ ] Test component unmount during compilation
- [ ] Test switching examples rapidly
- [ ] Add unit test with fake timers

---

## Phase 3: Medium Priority Improvements (Priority 3) 🟡

**Estimated Time**: 1 day
**Risk Level**: Low - Improves reliability and UX

### 3.1 Improve JSON Stringify in Console
**File**: `website/components/playground/ConsolePanel.tsx`
**Lines**: 10-29

### 3.2 Optimize Plugin Type Loading
**File**: `website/lib/playground/setup-monaco.ts`
**Lines**: 77-114

### 3.3 Add IndexedDB Fallback Cache
**File**: `website/lib/playground/schema-cache.ts`
**Lines**: 44-93

### 3.4 Refactor Compiler Worker
**File**: `website/lib/playground/compiler-worker-client.ts`
**Lines**: 9-14

*Detailed implementation steps for Phase 3 items can be added when Phase 1-2 are complete.*

---

## Phase 4: Code Quality & Infrastructure (Priority 4) 🟢

**Estimated Time**: 1 day
**Risk Level**: Minimal - Improves maintainability

### 4.1 Create Configuration Object
**File**: `website/lib/playground/config.ts` (new)

```typescript
export const PLAYGROUND_CONFIG = {
  // Compilation
  DEBOUNCE_MS: 500,
  COMPILATION_TIMEOUT_MS: 30000,
  EXECUTION_TIMEOUT_MS: 5000,

  // Caching
  CACHE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  MAX_MEMORY_CACHE_SIZE: 50, // Number of entries

  // External Resources
  ESBUILD_WASM_URL: 'https://unpkg.com/esbuild-wasm@0.27.1/esbuild.wasm',

  // UI
  SHARE_STATUS_TIMEOUT_MS: 2000,
  MONACO_LOAD_TIMEOUT_MS: 15000,

  // Feature Flags
  ENABLE_WORKER_COMPILATION: true,
  ENABLE_CACHE: true,
  ENABLE_CONSOLE_LOGS: true,
} as const;

export type PlaygroundConfig = typeof PLAYGROUND_CONFIG;
```

### 4.2 Create Debug Logger
**File**: `website/lib/playground/logger.ts` (new)

```typescript
const IS_DEV = process.env.NODE_ENV === 'development';
const IS_DEBUG = IS_DEV || typeof window !== 'undefined' &&
  (window.localStorage?.getItem('DEBUG_PLAYGROUND') === 'true');

export const logger = {
  debug: (...args: unknown[]) => {
    if (IS_DEBUG) {
      console.log('[Playground]', ...args);
    }
  },

  info: (...args: unknown[]) => {
    console.info('[Playground]', ...args);
  },

  warn: (...args: unknown[]) => {
    console.warn('[Playground]', ...args);
  },

  error: (...args: unknown[]) => {
    console.error('[Playground]', ...args);
  },

  // Specialized loggers
  compiler: {
    debug: (...args: unknown[]) => IS_DEBUG && console.log('[Compiler]', ...args),
    info: (...args: unknown[]) => console.info('[Compiler]', ...args),
  },

  monaco: {
    debug: (...args: unknown[]) => IS_DEBUG && console.log('[Monaco]', ...args),
    info: (...args: unknown[]) => console.info('[Monaco]', ...args),
  },

  cache: {
    debug: (...args: unknown[]) => IS_DEBUG && console.log('[Cache]', ...args),
    info: (...args: unknown[]) => console.info('[Cache]', ...args),
  },
};
```

### 4.3 Add Error Boundaries
Wrap major components in error boundaries

### 4.4 Add Unit Tests
Create test files for utilities

---

## Implementation Order

1. **Day 1**: Phase 1 - Critical fixes (#1.1, #1.2, #1.3)
2. **Day 2**: Phase 2 - High priority (#2.1, #2.2, #2.4)
3. **Day 3**: Phase 2 continued (#2.3) + Start Phase 3
4. **Day 4**: Phase 3 - Medium priority improvements
5. **Day 5**: Phase 4 - Code quality + Testing

---

## Testing Strategy

For each fix:
1. ✅ Write unit test (if applicable)
2. ✅ Add E2E test case
3. ✅ Manual testing in browser
4. ✅ Test in different browsers (Chrome, Firefox, Safari)
5. ✅ Test error cases
6. ✅ Performance testing (if applicable)

---

## Success Criteria

- [ ] All critical security issues resolved
- [ ] All high priority bugs fixed
- [ ] No new failing tests
- [ ] No performance regressions
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Changeset created

---

## Rollback Plan

If issues are discovered after deployment:
1. Revert to previous commit
2. Deploy hotfix branch
3. Document issue in GitHub
4. Add regression test
5. Fix and redeploy

---

## Notes

- **Browser Support**: Target modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- **TypeScript**: Ensure strict mode compliance
- **Bundle Size**: Monitor impact on bundle size
- **Accessibility**: Maintain WCAG 2.1 AA compliance
- **Performance**: No visible performance degradation

---

## Related Documents

- [PLAYGROUND_STATUS.md](./PLAYGROUND_STATUS.md) - Current status
- [PLAYGROUND_COMPLETION_SUMMARY.md](./PLAYGROUND_COMPLETION_SUMMARY.md) - Features
- Code Review - Full analysis (provided separately)

---

**Next Steps**: Begin Phase 1 implementation starting with unsafe code execution fix.
