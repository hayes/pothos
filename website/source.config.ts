import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
// Shared Pothos syntax themes — the SAME token/palette definitions the
// playground Monaco editor loads (lib/playground/monaco-theme.ts). Wiring
// shiki to these exact files keeps docs code blocks and the editor on one
// palette in both light and dark. They are valid VS Code / shiki themes;
// shiki reads `colors` + `tokenColors` and ignores the Monaco-only extras.
import cuttingLight from './lib/playground/themes/cutting-light.json';
import forestDark from './lib/playground/themes/forest-dark.json';
import { remarkMultiRegion } from './lib/remark-multi-region';

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
    // Function form so remarkMultiRegion is prepended ahead of the WHOLE
    // fumadocs preset — critically before `remarkCodeTab`, which merges
    // consecutive `tab=` code fences. `remarkMultiRegion` must have already
    // turned `<includeregions>` elements into `code` nodes by the time
    // `remarkCodeTab` runs, or the object-types variant tabs won't merge.
    // `v` is the resolved preset plugin list (it still includes remarkNpm),
    // so npm code blocks keep working without an explicit entry here.
    // `v` is contextually typed as fumadocs' Pluggable[] by the
    // ResolvePlugins function-form signature. remarkMultiRegion is a
    // standard remark plugin factory (returns an mdast transformer), typed
    // against local mdast shapes in its own module to stay dependency-free
    // (the `unified` types are not resolvable from the project root), so
    // bridge it to Pluggable via `v`'s element type at this one boundary.
    remarkPlugins: (v) => [remarkMultiRegion as unknown as (typeof v)[number], ...v],
    rehypeCodeOptions: {
      themes: {
        // These files are VS Code themes shared with the Monaco editor.
        // Two shape reconciliations vs shiki's stricter TS types (both
        // fields shiki ignores or re-narrows at runtime):
        //  - `type` widens to `string` on JSON import → pin to a literal.
        //  - `semanticTokenColors` has object-valued entries here, but
        //    shiki types it as `Record<string, string>` and does not use
        //    it → drop it.
        light: { ...cuttingLight, type: 'light' as const, semanticTokenColors: undefined },
        dark: { ...forestDark, type: 'dark' as const, semanticTokenColors: undefined },
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
