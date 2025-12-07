export interface PlaygroundFile {
  filename: string;
  content: string;
  language?: 'typescript' | 'graphql';
  /** Highlighted line ranges for documentation snippets */
  highlights?: Array<{ start: number; end: number; label?: string }>;
}

export interface Step {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface CodeSnippet {
  /** Label for this snippet (e.g., "Object Definition", "Field Resolver") */
  label: string;
  /** The file this snippet is from */
  filename: string;
  /** Line range to highlight (1-indexed) */
  startLine: number;
  endLine: number;
  /** Optional description of what this snippet demonstrates */
  description?: string;
}

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
