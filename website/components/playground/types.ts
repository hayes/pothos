export interface PlaygroundFile {
  filename: string;
  content: string;
  language?: 'typescript' | 'graphql';
  /** Highlighted line ranges for documentation snippets */
  highlights?: Array<{ start: number; end: number; label?: string }>;
}

// `Step` and `CodeSnippet` are owned by the build-examples generator —
// re-exporting here keeps a single canonical definition.
import type { CodeSnippet, Step } from './examples/examples-index.generated';

export type { CodeSnippet, Step };

export interface PlaygroundExample {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  category?: 'core' | 'plugins' | 'examples' | 'patterns';
  subcategory?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  order?: number;
  relatedDocs?: string[];
  prerequisites?: string[];
  steps?: Step[];
  files: PlaygroundFile[];
  defaultQuery: string;
  /** Multiple queries to load as separate tabs */
  queries?: Array<{ title?: string; query: string; variables?: string }>;
  /** Code snippets for documentation linking */
  snippets?: CodeSnippet[];
}

export type PlaygroundTab = 'code' | 'schema' | 'graphiql';
