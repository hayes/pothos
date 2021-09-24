const slug = require("rehype-slug");
const toc = require("@jsdevtools/rehype-toc");

const withMDX = require('@next/mdx')({
    extension: /\.mdx?$/,
    options: {
        remarkPlugins: [],
        rehypePlugins: [slug, toc],
    },
})

  module.exports = withMDX({
    pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  })