import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { remark } from 'remark';
import remarkMdx from 'remark-mdx';

/** Read literal and source-backed code blocks using the authoring include convention. */
export async function docCodeBlocks(website, page, language, { includesOnly = false } = {}) {
  const pagePath = resolve(website, 'content/docs', page);
  let source = await readFile(pagePath, 'utf8');
  const includes = [
    ...source.matchAll(/<include(?:regions)?\b([^>]*)>([^<]+)<\/include(?:regions)?>/g),
  ];
  if (includesOnly) {
    source = includes.map((match) => match[0]).join('\n\n');
  }
  for (const match of includes) {
    const attributes = match[1];
    const [filename, selection] = match[2].trim().split('#');
    const path = resolve(/\bcwd\b/.test(attributes) ? website : dirname(pagePath), filename);
    const contents = await readFile(path, 'utf8');
    const snippets = (selection ? selection.split(',') : [null]).map((region) => {
      if (!region) {
        return contents;
      }
      const lines = contents.split('\n');
      const start = lines.findIndex((line) => line.trim() === `// #region ${region}`);
      const end = lines.findIndex(
        (line, index) => index > start && line.trim() === `// #endregion ${region}`,
      );
      if (start < 0 || end < 0) {
        throw new Error(`Missing region ${region} in ${path}`);
      }
      return lines.slice(start + 1, end).join('\n');
    });
    const code = snippets
      .join('\n\n')
      .split('\n')
      .filter((line) => !/^\s*\/\/\s*#(?:end)?region\b/.test(line))
      .join('\n');
    const lang = attributes.match(/lang=["']([^"']+)["']/)?.[1] ?? 'typescript';
    source = source.replace(match[0], `\`\`\`${lang}\n${code.trimEnd()}\n\`\`\``);
  }
  return parseCodeBlocks(source, language);
}

/** Include indented fences inside callouts, tabs, and other MDX containers. */
export function parseCodeBlocks(source, language) {
  const blocks = [];
  function visit(node) {
    if (node.type === 'code' && (!language || node.lang === language)) {
      blocks.push(`${node.value}\n`);
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  }
  visit(remark().use(remarkMdx).parse(source));
  return blocks;
}
