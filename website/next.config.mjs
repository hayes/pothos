import './util/build-index.mjs';
import dotenv from 'dotenv';
import graphql from 'highlightjs-graphql';
import highlight from 'rehype-highlight';
import slug from 'rehype-slug';
import frontmatter from 'remark-frontmatter';
import { remarkMdxFrontmatter } from 'remark-mdx-frontmatter';
import withMDX from '@next/mdx';

dotenv.config();

export default withMDX({
  extension: /\.mdx?$/,
  options: {
    providerImportSource: '@mdx-js/react',
    remarkPlugins: [
      frontmatter,
      remarkMdxFrontmatter,
      // [
      //   torchlight,
      //   {
      //     token: process.env.TORCH_LIGHT_TOKEN,
      //     theme: 'one-dark-pro',
      //   },
      // ],
    ],
    rehypePlugins: [slug, [highlight, { languages: { graphql: graphql.definer } }]],
  },
})({
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
});
