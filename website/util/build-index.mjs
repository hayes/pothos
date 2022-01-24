import path from 'path';
import url from 'url';
import slug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { remark } from 'remark';
import remarkMDX from 'remark-mdx';
import remarkRehype from 'remark-rehype';
import boostModule from '@boost/module';

const docsProcessor = remark().use(remarkMDX).use(removeMdx);
const chunkProcessor = remark().use(remarkRehype).use(slug).use(rehypeStringify);

function removeMdx() {
  return (node) => ({
    ...node,
    children: node.children.filter((child) => !child.type.startsWith('mdxjs')),
  });
}

const docs = boostModule
  .requireModule(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), './build-nav.ts'))
  .loadDocsFiles();

export const docsIndex = docs.map((doc) => {
  const ast = docsProcessor.runSync(docsProcessor.parse(doc.content));

  return {
    ...doc,
    sections: markdownSections(doc),
    md: docsProcessor.stringify(ast),
    html: chunkProcessor.stringify(chunkProcessor.runSync(ast)),
  };
});

function markdownSections(file) {
  const tree = docsProcessor.runSync(docsProcessor.parse(file.content));
  const firstNode = tree.children[0];
  const headings = [firstNode.type === 'heading' ? firstNode : null];

  const sections = [
    {
      ...tree,
      children: firstNode.type === 'heading' ? [] : [firstNode],
    },
  ];

  for (let i = 1; i < tree.children.length; i += 1) {
    const node = tree.children[i];

    if (node.type === 'heading') {
      sections.push({
        ...tree,
        children: [],
      });
      headings.push(node);
    } else {
      sections[sections.length - 1].children.push(node);
    }
  }

  return sections.map((section, i) => {
    const html = chunkProcessor.stringify(chunkProcessor.runSync(section));
    const id = headings[i]
      ? chunkProcessor
          .stringify(chunkProcessor.runSync(headings[i]))
          .match(/<h\d id="([^"]+)"/)?.[1] ?? ''
      : '';

    return {
      ast: section,
      heading: headings[i] ? toPlainText(headings[i]) : '',
      text: toPlainText(section),
      link: `${file.link}#${id}`,
      md: docsProcessor.stringify(section),
      html,
    };
  });
}

function toPlainText(node) {
  if (node.children) {
    return node.children.map(toPlainText).join(' ');
  }

  return node.value;
}
