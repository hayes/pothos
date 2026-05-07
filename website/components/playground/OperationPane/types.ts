export interface Operation {
  id: string;
  /** Operation name parsed from the query, or "Untitled-N". */
  name: string;
  query: string;
  variables: string;
  headers: HeaderEntry[];
  /** Has unsaved/uncommitted changes vs. last loaded state. */
  dirty: boolean;
}

export interface HeaderEntry {
  id: string;
  name: string;
  value: string;
}

export type OperationSubTab = 'query' | 'variables' | 'headers';
