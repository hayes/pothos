export interface PlaygroundFile {
  filename: string;
  content: string;
  language?: 'typescript' | 'graphql';
}

export interface PlaygroundExample {
  id: string;
  title: string;
  description?: string;
  files: PlaygroundFile[];
  defaultQuery: string;
  /** Multiple queries to load as separate tabs */
  queries?: Array<{ title?: string; query: string; variables?: string }>;
}

export type PlaygroundTab = 'code' | 'schema' | 'graphiql';
