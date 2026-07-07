'use client';

import type { Monaco } from '@monaco-editor/react';
import type { GraphQLSchema } from 'graphql';

// Schema-aware autocomplete + diagnostics for the GraphQL query editor.
// We register our own Monaco providers that defer to
// `graphql-language-service` (autocomplete, validation) so the
// CDN-loaded monaco from `@monaco-editor/react` stays untouched —
// pulling in `monaco-graphql` / `monaco-editor` directly would force a
// bundled monaco-editor instance and bring its own worker + CSS
// plumbing.

const MARKER_OWNER = 'graphql';

let schemaRef: GraphQLSchema | null = null;
let registeredMonaco: Monaco | null = null;
// Per-model subscription disposers, keyed by Monaco IModel. We store
// these so a model going away cleans its listener; we walk the values
// to re-validate every active model when the schema changes.
let modelSubs: WeakMap<object, { dispose(): void }> | null = null;
const liveModels = new Set<object>();
let revalidate: () => void = () => {};

/**
 * Set the schema the language service answers against. Re-runs
 * validation against every open GraphQL model so existing diagnostics
 * reflect the new schema.
 */
export function setGraphQLSchema(schema: GraphQLSchema): void {
  schemaRef = schema;
  revalidate();
}

/**
 * Register a Monaco completion + validation provider for the `graphql`
 * language. Idempotent for the same Monaco instance.
 */
export async function registerGraphQLLanguage(monaco: Monaco): Promise<void> {
  if (registeredMonaco === monaco) {
    return;
  }
  registeredMonaco = monaco;

  // graphql-language-service is loaded lazily so it's not in the
  // initial /playground chunk.
  const { getAutocompleteSuggestions, getDiagnostics, CompletionItemKind, Position } = await import(
    'graphql-language-service'
  );

  modelSubs = new WeakMap();

  // Validation: compute diagnostics for one GraphQL model and write
  // them as Monaco markers. Owner-string keeps these distinct from
  // markers other providers might attach to the same model.
  const validateModel = (model: ReturnType<Monaco['editor']['getModel']>) => {
    if (!model) {
      return;
    }
    const schema = schemaRef;
    if (!schema) {
      monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      return;
    }
    let diagnostics: ReturnType<typeof getDiagnostics>;
    try {
      diagnostics = getDiagnostics(model.getValue(), schema);
    } catch {
      return;
    }
    monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      diagnostics.map((d) => ({
        // graphql-language-service returns 0-indexed positions; Monaco is 1-indexed.
        startLineNumber: d.range.start.line + 1,
        startColumn: d.range.start.character + 1,
        endLineNumber: d.range.end.line + 1,
        endColumn: d.range.end.character + 1,
        message: d.message,
        // vscode-languageserver-types DiagnosticSeverity: 1=Error, 2=Warning, 3=Info, 4=Hint
        // monaco MarkerSeverity:                          8=Error, 4=Warning, 2=Info, 1=Hint
        severity:
          d.severity === 1
            ? monaco.MarkerSeverity.Error
            : d.severity === 2
              ? monaco.MarkerSeverity.Warning
              : d.severity === 4
                ? monaco.MarkerSeverity.Hint
                : monaco.MarkerSeverity.Info,
        source: 'graphql',
      })),
    );
  };

  // Track every GraphQL model so we can re-validate on schema changes.
  // `onDidCreateModel` covers any new editor mounted later; for models
  // that already existed when this registration runs (the first
  // QueryEditor), we walk `getModels()` once below.
  const trackModel = (model: ReturnType<Monaco['editor']['getModel']>) => {
    if (!model) {
      return;
    }
    if (model.getLanguageId() !== 'graphql') {
      return;
    }
    if (modelSubs?.has(model)) {
      return;
    }
    liveModels.add(model);
    const sub = model.onDidChangeContent(() => validateModel(model));
    modelSubs?.set(model, sub);
    validateModel(model);
  };

  monaco.editor.onDidCreateModel(trackModel);
  monaco.editor.onWillDisposeModel((model) => {
    modelSubs?.get(model)?.dispose();
    modelSubs?.delete(model);
    liveModels.delete(model);
  });
  for (const m of monaco.editor.getModels()) {
    trackModel(m);
  }

  revalidate = () => {
    for (const model of liveModels) {
      validateModel(model as ReturnType<Monaco['editor']['getModel']>);
    }
  };

  monaco.languages.registerCompletionItemProvider('graphql', {
    triggerCharacters: ['{', ' ', ':', '(', '$', '@', '\n', '.'],
    provideCompletionItems(model, position) {
      const schema = schemaRef;
      if (!schema) {
        return { suggestions: [] };
      }

      const text = model.getValue();
      // graphql-language-service positions are 0-indexed; Monaco is 1-indexed.
      const cursor = new Position(position.lineNumber - 1, position.column - 1);

      let raw: ReturnType<typeof getAutocompleteSuggestions>;
      try {
        raw = getAutocompleteSuggestions(schema, text, cursor);
      } catch {
        return { suggestions: [] };
      }

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      return {
        suggestions: raw.map((s) => ({
          label: typeof s.label === 'string' ? s.label : String(s.label),
          kind: toMonacoKind(monaco, s.kind, CompletionItemKind),
          insertText:
            typeof s.insertText === 'string' && s.insertText.length > 0
              ? s.insertText
              : typeof s.label === 'string'
                ? s.label
                : String(s.label),
          insertTextRules:
            typeof s.insertText === 'string' && s.insertText.includes('$')
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
          detail: typeof s.detail === 'string' ? s.detail : undefined,
          documentation:
            typeof s.documentation === 'string' && s.documentation.length > 0
              ? s.documentation
              : undefined,
          range,
        })),
      };
    },
  });
}

function toMonacoKind(
  monaco: Monaco,
  glsKind: number | undefined,
  Glk: typeof import('graphql-language-service').CompletionItemKind,
): number {
  const Mk = monaco.languages.CompletionItemKind;
  switch (glsKind) {
    case Glk.Field:
      return Mk.Field;
    case Glk.Variable:
      return Mk.Variable;
    case Glk.Class:
    case Glk.Interface:
    case Glk.Struct:
      return Mk.Class;
    case Glk.Enum:
      return Mk.Enum;
    case Glk.EnumMember:
      return Mk.EnumMember;
    case Glk.Keyword:
      return Mk.Keyword;
    case Glk.Function:
    case Glk.Method:
      return Mk.Function;
    case Glk.Constant:
      return Mk.Constant;
    case Glk.Property:
      return Mk.Property;
    case Glk.Value:
      return Mk.Value;
    case Glk.Constructor:
      return Mk.Constructor;
    default:
      return Mk.Text;
  }
}
