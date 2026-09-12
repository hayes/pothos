import { parse, print } from 'graphql';

/** Format compact documentation-link queries before opening them in the editor. */
export function formatLinkedQuery(query: string): string {
  // GraphQL's printer discards comments. Preserve annotated queries as authored.
  if (query.includes('#')) {
    return query;
  }

  try {
    return print(parse(query));
  } catch {
    // Keep incomplete queries editable so the editor can explain the syntax error.
    return query;
  }
}
