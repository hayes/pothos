import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
// Assume you're using Fumadocs UI
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ...components,
    Tab,
    Tabs,
  };
}
