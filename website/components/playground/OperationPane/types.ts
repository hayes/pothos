export interface Operation {
  id: string;
  /** Operation name parsed from the query, or "Untitled-N". */
  name: string;
  query: string;
  variables: string;
  headers: HeaderEntry[];
  /**
   * JSON object provided as `contextValue` to graphql() when running.
   * Plugins like `scope-auth` read fields off this (e.g. `context.user`).
   * Stored as a string so the editor can keep partial JSON while typing.
   */
  context: string;
  /** Has unsaved/uncommitted changes vs. last loaded state. */
  dirty: boolean;
}

export interface HeaderEntry {
  id: string;
  name: string;
  value: string;
}

export type OperationSubTab = 'query' | 'variables' | 'headers' | 'context';
