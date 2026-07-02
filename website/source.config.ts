import { remarkNpm } from 'fumadocs-core/mdx-plugins';
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const { docs, meta } = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkNpm],
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      // Add transformer to preserve custom meta attributes
      transformers: [
        {
          name: 'playground-attributes',
          pre(node) {
            // node.properties contains the HTML attributes
            // In Shiki transformers, meta is available via this.options
            const context = this as unknown as {
              options?: { meta?: { __raw?: string | null } | string };
            };

            // Extract the raw meta string - it can be in different formats
            const metaValue = context.options?.meta;

            // Skip if no meta or meta is not useful
            if (!metaValue) {
              return node;
            }

            let metaRaw = '';

            if (typeof metaValue === 'string') {
              metaRaw = metaValue;
            } else if (typeof metaValue === 'object' && '__raw' in metaValue) {
              const rawValue = metaValue.__raw;
              if (typeof rawValue === 'string') {
                metaRaw = rawValue;
              }
            }

            // Only process if we have a non-empty string
            if (!metaRaw || metaRaw.trim() === '') {
              return node;
            }

            // Parse playground attributes from meta string
            if (metaRaw.includes('playground')) {
              node.properties['data-playground'] = 'true';

              // Add the raw code content as a data attribute
              // The code is available via this.source
              const contextWithSource = this as unknown as { source?: string };
              if (contextWithSource.source) {
                // Base64 encode to handle special characters safely
                node.properties['data-raw-code'] = Buffer.from(contextWithSource.source).toString(
                  'base64',
                );
              }
            }

            const exampleMatch = metaRaw.match(/example=["']([^"']+)["']/);
            if (exampleMatch?.[1]) {
              node.properties['data-example'] = exampleMatch[1];
            }

            const queryMatch = metaRaw.match(/query=["']([^"']+)["']/);
            if (queryMatch?.[1]) {
              node.properties['data-query'] = queryMatch[1];
            }

            // NOTE: switchable definition styles use fumadocs' built-in
            // code-block tabs — consecutive fences with a `tab="<Label>"`
            // meta attribute are merged into one tabbed block by
            // fumadocs itself, so nothing needs parsing here. Each tab's
            // fence keeps its own `example=` (resolved above), so "Open
            // in Playground" opens the selected variant's bundle.

            return node;
          },
        },
      ],
    },
  },
});
