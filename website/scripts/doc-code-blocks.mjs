import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Read literal and source-backed code blocks using the authoring include convention. */
export async function docCodeBlocks(website, page, language) {
  const pagePath = resolve(website, 'content/docs', page);
  let source = await readFile(pagePath, 'utf8');
  const includes = [...source.matchAll(/<include(?:regions)?\b([^>]*)>([^<]+)<\/include(?:regions)?>/g)];
  for (const match of includes) {
    const attributes = match[1];
    const [filename, selection] = match[2].trim().split('#');
    const path = resolve(/\bcwd\b/.test(attributes) ? website : dirname(pagePath), filename);
    const contents = await readFile(path, 'utf8');
    const snippets = (selection ? selection.split(',') : [null]).map(region => {
      if (!region) return contents;
      const lines = contents.split('\n');
      const start = lines.findIndex(line => line.trim() === `// #region ${region}`);
      const end = lines.findIndex((line, index) => index > start && line.trim() === `// #endregion ${region}`);
      if (start < 0 || end < 0) throw new Error(`Missing region ${region} in ${path}`);
      return lines.slice(start + 1, end).join('\n');
    });
    const code = snippets.join('\n\n').split('\n').filter(line => !/^\s*\/\/\s*#(?:end)?region\b/.test(line)).join('\n');
    const lang = attributes.match(/lang=["']([^"']+)["']/)?.[1] ?? 'typescript';
    source = source.replace(match[0], `\`\`\`${lang}\n${code.trimEnd()}\n\`\`\``);
  }
  return [...source.matchAll(/^```([^\n]+)\n([\s\S]*?)^```/gm)]
    .filter(match => match[1].split(/\s/)[0] === language)
    .map(match => match[2]);
}
