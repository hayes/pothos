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
}

export type PlaygroundTab = 'code' | 'schema' | 'graphiql';
