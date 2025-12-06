import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
// Assume you're using Fumadocs UI
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';
import { PlaygroundCodeBlock } from './components/code-snippet/PlaygroundCodeBlock';
import { PlaygroundEmbed } from './components/playground';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ...components,
    Tab,
    Tabs,
    PlaygroundEmbed,
    // Override pre to support playground meta attributes
    pre: (props: ComponentProps<'pre'>) => {
      // Extract custom data attributes added by our Shiki transformer
      const propsWithData = props as ComponentProps<'pre'> & {
        'data-playground'?: string;
        'data-example'?: string;
        'data-query'?: string;
        'data-raw-code'?: string;
      };

      const hasPlayground = propsWithData['data-playground'] === 'true';
      const exampleId = propsWithData['data-example'];
      const query = propsWithData['data-query'];

      // Decode the raw code if available
      let rawCode: string | undefined;
      if (propsWithData['data-raw-code']) {
        try {
          rawCode = Buffer.from(propsWithData['data-raw-code'], 'base64').toString('utf-8');
        } catch (err) {
          console.error('Failed to decode raw code:', err);
        }
      }

      return (
        <PlaygroundCodeBlock
          {...props}
          playground={hasPlayground}
          exampleId={exampleId}
          query={query}
          code={rawCode}
        />
      );
    },
  };
}
