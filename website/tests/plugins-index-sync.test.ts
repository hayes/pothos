import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLUGINS, pluginDocsHref } from '../components/plugins/plugins';

/**
 * The plugin catalog on the docs landing page
 * (`content/docs/plugins/index.mdx`) is hand-authored MDX, but its cards
 * must mirror the canonical data module `components/plugins/plugins.ts` —
 * the single source of truth that also drives the /plugins route and the
 * homepage garden. This test fails CI if the two drift on title, href, or
 * description.
 */

const INDEX_MDX = join(__dirname, '../content/docs/plugins/index.mdx');

interface Card {
  title: string;
  href: string;
  description: string;
}

/** Pull one attribute value out of a `<Card ...>` block (attribute-string form). */
function attr(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1];
}

function parseCards(mdx: string): Card[] {
  // Split on the opening of each Card tag; drop the pre-first-card preamble.
  const chunks = mdx.split(/<Card\b/).slice(1);
  return chunks.map((chunk) => {
    const block = chunk.slice(0, chunk.indexOf('/>'));
    const title = attr(block, 'title');
    const href = attr(block, 'href');
    const description = attr(block, 'description');
    if (!title || !href || description === undefined) {
      throw new Error(`Malformed <Card> in index.mdx: ${block.trim()}`);
    }
    return { title, href, description };
  });
}

describe('plugins/index.mdx stays in sync with the plugin data module', () => {
  const cards = parseCards(readFileSync(INDEX_MDX, 'utf8'));

  it('lists exactly the plugins in the data module (by href)', () => {
    const cardHrefs = cards.map((c) => c.href).sort();
    const dataHrefs = PLUGINS.map((p) => pluginDocsHref(p.slug)).sort();
    expect(cardHrefs).toEqual(dataHrefs);
  });

  it('has no duplicate cards', () => {
    const hrefs = cards.map((c) => c.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('matches each plugin name and description exactly', () => {
    const byHref = new Map(cards.map((c) => [c.href, c]));
    for (const plugin of PLUGINS) {
      const href = pluginDocsHref(plugin.slug);
      const card = byHref.get(href);
      expect(card, `missing card for ${href}`).toBeDefined();
      expect(card?.title, `title mismatch for ${href}`).toBe(plugin.name);
      expect(card?.description, `description mismatch for ${href}`).toBe(plugin.description);
    }
  });
});
