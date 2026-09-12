/** Find a rendered excerpt in its source, allowing the docs renderer to dedent it. */
export function findSnippetLine(source: string, snippet: string): number {
  const expected = snippet
    .trim()
    .split('\n')
    .map((line) => line.trim());
  if (!expected[0]) {
    return -1;
  }
  const lines = source.split('\n').map((line) => line.trim());
  return lines.findIndex((_, start) =>
    expected.every((line, offset) => lines[start + offset] === line),
  );
}
