import { remarkInstall } from 'fumadocs-docgen';
import createMDX from 'fumadocs-mdx/config';

const withMDX = createMDX({
  mdxOptions: {
    remarkPlugins: [remarkInstall],
  },
});

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withMDX(config);
