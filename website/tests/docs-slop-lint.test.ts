import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Automated lint for writing patterns banned by .claude/docs-corrections-ledger.md.
 * Extend BANNED_PATTERNS / thresholds whenever the maintainer names a new pattern
 * (ledger S38). Prose only: code fences, inline code, and frontmatter are stripped
 * before matching.
 */

const DOCS_DIR = join(__dirname, '..', 'content', 'docs');

// Pages allowed to keep the "This page walks through" stem (the approved exemplar).
const WALKS_THROUGH_ALLOWLIST = new Set(['getting-started/installation.mdx']);

// Migration guides keep their original register and are excluded entirely.
const EXCLUDED_DIRS = new Set(['migrations']);

const MAX_EM_DASHES_PER_PAGE = 2;

const BANNED_PATTERNS: { name: string; pattern: RegExp }[] = [
  // A8 family — rhetorical contrast snaps
  { name: 'A8 "not just"', pattern: /\bnot just\b/i },
  { name: 'A8 "more than just"', pattern: /\bmore than just\b/i },
  { name: 'A8 "isn\'t X — it\'s Y" snap', pattern: /\bisn't [^.\n]{0,60}—\s*it'?s\b/i },
  { name: 'A8 "not X. It\'s Y." snap', pattern: /\bnot [^.\n]{0,60}\. It'?s\b/ },
  // A9 — mic-drop / payoff lines
  { name: 'A9 "That\'s the whole"', pattern: /that'?s the whole\b/i },
  { name: 'A9 "the payoff"', pattern: /\bthe payoff\b/i },
  { name: 'A9 "That\'s it."', pattern: /\bThat'?s it\.\s*$/m },
  // A10 — selling register
  { name: 'A10 "out of the box"', pattern: /\bout of the box\b/i },
  { name: 'A10 "seamless"', pattern: /\bseamless(ly)?\b/i },
  { name: 'A10 "effortless"', pattern: /\beffortless(ly)?\b/i },
  { name: 'A10 "blazing"', pattern: /\bblazing\b/i },
  { name: 'A10 "supercharge"', pattern: /\bsupercharge/i },
  { name: 'A10 "just works"', pattern: /\bjust works\b/i },
  { name: 'A10 "done right"', pattern: /\bdone right\b/i },
  { name: 'A10 "the smart way"', pattern: /\bthe smart way\b/i },
  { name: 'A10 "earns its keep"', pattern: /\bearns its keep\b/i },
  { name: 'A10 "the (Pothos|X) way"', pattern: /,\s*the \w+ way\b/i },
  // S1/S7 — advisory register
  { name: 'S1/S7 "reach for"', pattern: /\breach for\b/i },
  // Hedge-filler and editorializing (round-6 second pass)
  { name: 'hedge "which is useful"', pattern: /\bwhich (is useful|helps|makes it easy)\b/i },
  { name: 'superlative "the cleanest/best/right way"', pattern: /\bthe (cleanest|best|right) way\b/i },
  { name: 'aphorism "pays off"', pattern: /\bpays off\b/i },
  { name: 'advisory "worth it when"', pattern: /\bworth it when\b/i },
  { name: 'snap "for exactly this"', pattern: /\bfor exactly this\b/i },
  // S27 — robotic meta-commentary
  { name: 'S27 "first-class"', pattern: /\bfirst-class\b/i },
  { name: 'S27 "the rest of (this guide|these guides)"', pattern: /\bthe rest of (this guide|these guides)\b/i },
  // U5 — nav-duplicating callouts
  { name: 'U5 "See also:"', pattern: /See also:/ },
  { name: 'U5 "Next: [" callout', pattern: /^\s*Next: \[/m },
  // Retired naming
  { name: 'canonical cast: ctx.viewer retired', pattern: /\bctx\.viewer\b|\bcontext\.viewer\b/ },
];

function listMdx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) out.push(...listMdx(full));
    } else if (entry.endsWith('.mdx')) {
      out.push(full);
    }
  }
  return out;
}

/** Strip frontmatter, code fences, and inline code so only prose is linted. */
function proseOf(source: string): string {
  let text = source.replace(/^---\n[\s\S]*?\n---\n/, '');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/<include[\s\S]*?<\/include(?:regions)?>/g, '');
  text = text.replace(/`[^`\n]*`/g, '');
  return text;
}

describe('docs slop lint (ledger S38)', () => {
  const files = listMdx(DOCS_DIR);

  it('finds docs pages', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  for (const file of files) {
    const rel = relative(DOCS_DIR, file);
    describe(rel, () => {
      const prose = proseOf(readFileSync(file, 'utf8'));

      it('contains no banned patterns', () => {
        const hits: string[] = [];
        for (const { name, pattern } of BANNED_PATTERNS) {
          const match = prose.match(pattern);
          if (match) hits.push(`${name}: "…${match[0]}…"`);
        }
        expect(hits, hits.join('\n')).toEqual([]);
      });

      it(`uses at most ${MAX_EM_DASHES_PER_PAGE} em-dashes in prose`, () => {
        const count = (prose.match(/—/g) ?? []).length;
        expect(count, `${count} em-dashes in ${rel}`).toBeLessThanOrEqual(MAX_EM_DASHES_PER_PAGE);
      });

      it('does not reuse the exemplar opener stem', () => {
        if (WALKS_THROUGH_ALLOWLIST.has(rel.replace(/\\/g, '/'))) return;
        expect(prose.includes('This page walks through')).toBe(false);
      });
    });
  }
});
