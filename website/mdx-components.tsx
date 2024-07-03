import type { MDXComponents } from 'mdx/types';
// Assume you're using Fumadocs UI
import defaultComponents from 'fumadocs-ui/mdx';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ...components,
  };
}
