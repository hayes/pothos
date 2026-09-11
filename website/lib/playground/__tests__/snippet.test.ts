import { describe, expect, it } from 'vitest';
import { findSnippetLine } from '../snippet';

describe('docs excerpt source navigation', () => {
  it('finds a dedented field inside a type definition', () => {
    const source =
      'fields: (t) => ({\n    fullName: t.string({\n      resolve: (user) => user.name,\n    }),\n})';
    expect(
      findSnippetLine(source, 'fullName: t.string({\n  resolve: (user) => user.name,\n}),'),
    ).toBe(1);
  });
  it('does not match an empty or different implementation', () => {
    expect(findSnippetLine('firstName: t.exposeString("firstName"),', '')).toBe(-1);
    expect(
      findSnippetLine(
        'firstName: t.exposeString("firstName"),',
        'firstName: t.exposeString("lastName"),',
      ),
    ).toBe(-1);
  });
});
