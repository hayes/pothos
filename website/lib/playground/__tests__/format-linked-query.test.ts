import { describe, expect, it } from 'vitest';
import { formatLinkedQuery } from '../format-linked-query';

describe('formatLinkedQuery', () => {
  it('expands nested selections from documentation links', () => {
    expect(formatLinkedQuery('{ author(id: 1) { fullName posts { title } } }')).toBe(`{
  author(id: 1) {
    fullName
    posts {
      title
    }
  }
}`);
  });

  it('preserves comments and incomplete queries', () => {
    for (const query of ['# Author name\n{ author(id: 1) { fullName } }', '{ author(']) {
      expect(formatLinkedQuery(query)).toBe(query);
    }
  });
});
