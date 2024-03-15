import './util/build-index.mjs';
import dotenv from 'dotenv';
import highlight from 'rehype-highlight';
import slug from 'rehype-slug';
import frontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import withMDX from '@next/mdx';

dotenv.config();

export default withMDX({
  extension: /\.mdx?$/,
  options: {
    providerImportSource: '@mdx-js/react',
    remarkPlugins: [frontmatter, remarkMdxFrontmatter],
    rehypePlugins: [slug, [highlight, { languages: {} }]],
  },
})({
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
});
