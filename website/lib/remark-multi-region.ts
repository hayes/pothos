/**
 * remark-multi-region — a composite companion to fumadocs' built-in
 * `<include>` (remark-include).
 *
 * ## Why this exists
 *
 * fumadocs ships `remark-include`, which single-sources a doc code fence
 * from an external file and extracts ONE VS Code `// #region <name>`
 * block: `<include lang="ts">path/schema.ts#region</include>`. It copies
 * the fence `meta` through, and — crucially — registers the target with
 * the webpack loader (`_compiler.addDependency`) so editing `schema.ts`
 * hot-reloads the page. That covers every fence that is a single
 * contiguous slice of its source file.
 *
 * Some teaching fences, though, show two or three NON-contiguous regions
 * of one file stitched together (e.g. an `interface` + the `objectRef`
 * that references it + its `implement` call, skipping the intervening
 * `Map` and `builder` boilerplate). `remark-include` cannot express that:
 * its specifier parser (`lastIndexOf("#")`) allows a single region name
 * only, and it runs FIRST in fumadocs' remark pipeline — so a
 * comma-separated `<include>…#a,b,c</include>` is grabbed by the built-in
 * plugin and throws `Region "a,b,c" not found` before anything else can
 * see it.
 *
 * This plugin therefore uses a DISTINCT element — `<includeregions>` —
 * that the built-in `remark-include` ignores (it only matches
 * `name === "include"`). It accepts a comma-separated region list,
 * concatenates the extracted regions, and emits a single `code` node,
 * reusing the exact same file-read + `extractCodeRegion` + `addDependency`
 * behaviour so hot-reload and Shiki highlighting are identical to native
 * includes.
 *
 * ## Ordering requirement
 *
 * fumadocs merges CONSECUTIVE code fences that carry a `tab="…"` meta into
 * one tabbed block via `remarkCodeTab`, which runs at a FIXED position in
 * the preset — before user remark plugins appended with `...v`. For the
 * three variant tabs on the object-types page to merge, this plugin must
 * turn `<includeregions>` into `code` nodes BEFORE `remarkCodeTab` runs.
 * That is achieved by registering it via the FUNCTION form of
 * `remarkPlugins` in `source.config.ts` — `(v) => [remarkMultiRegion,
 * ...v]` — which prepends it ahead of the whole preset (see that file).
 *
 * ## Region join separator
 *
 * Regions are joined with a single blank line (`\n\n`), which reproduces
 * the existing hand-authored fences byte-for-byte (they already separate
 * the stitched blocks with one blank line and show no elision marker). The
 * design doc floated a `\n\n// ...\n\n` elision separator; that is a
 * content change and is intentionally NOT used here so the migration is
 * byte-identical to the pre-migration fences.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const TAG_NAME = 'includeregions';

// ---------------------------------------------------------------------------
// VS Code–style region extraction.
//
// Copied verbatim (algorithm + marker table) from fumadocs-mdx's
// remark-include so multi-region extraction is byte-for-byte identical to
// what a native single-region `<include>` would produce. fumadocs does not
// export these, hence the local copy.
// ---------------------------------------------------------------------------

const REGION_MARKERS: Array<{ start: RegExp; end: RegExp }> = [
  {
    start: /^\s*\/\/\s*#?region\b\s*(.*?)\s*$/,
    end: /^\s*\/\/\s*#?endregion\b\s*(.*?)\s*$/,
  },
  {
    start: /^\s*<!--\s*#?region\b\s*(.*?)\s*-->/,
    end: /^\s*<!--\s*#?endregion\b\s*(.*?)\s*-->/,
  },
  {
    start: /^\s*\/\*\s*#region\b\s*(.*?)\s*\*\//,
    end: /^\s*\/\*\s*#endregion\b\s*(.*?)\s*\*\//,
  },
  {
    start: /^\s*#[rR]egion\b\s*(.*?)\s*$/,
    end: /^\s*#[eE]nd ?[rR]egion\b\s*(.*?)\s*$/,
  },
  {
    start: /^\s*#\s*#?region\b\s*(.*?)\s*$/,
    end: /^\s*#\s*#?endregion\b\s*(.*?)\s*$/,
  },
  {
    start: /^\s*(?:--|::|@?REM)\s*#region\b\s*(.*?)\s*$/,
    end: /^\s*(?:--|::|@?REM)\s*#endregion\b\s*(.*?)\s*$/,
  },
  {
    start: /^\s*#pragma\s+region\b\s*(.*?)\s*$/,
    end: /^\s*#pragma\s+endregion\b\s*(.*?)\s*$/,
  },
  {
    start: /^\s*\(\*\s*#region\b\s*(.*?)\s*\*\)/,
    end: /^\s*\(\*\s*#endregion\b\s*(.*?)\s*\*\)/,
  },
];

function dedent(lines: string[]): string {
  const minIndent = lines.reduce((min, line) => {
    const match = line.match(/^(\s*)\S/);
    return match ? Math.min(min, match[1].length) : min;
  }, Number.POSITIVE_INFINITY);
  return minIndent === Number.POSITIVE_INFINITY
    ? lines.join('\n')
    : lines.map((l) => l.slice(minIndent)).join('\n');
}

export function extractCodeRegion(content: string, regionName: string): string {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const re of REGION_MARKERS) {
      let match = re.start.exec(lines[i]);
      if (match?.[1] !== regionName) {
        continue;
      }
      let depth = 1;
      const extractedLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        match = re.start.exec(lines[j]);
        if (match) {
          depth++;
          continue;
        }
        match = re.end.exec(lines[j]);
        if (match) {
          if (match[1] === regionName) {
            depth = 0;
          } else if (match[1] === '') {
            depth--;
          } else {
            continue;
          }
          if (depth > 0) {
            continue;
          }
          return dedent(extractedLines);
        }
        extractedLines.push(lines[j]);
      }
    }
  }
  throw new Error(`Region "${regionName}" not found`);
}

/**
 * Split an include specifier (`path/to/file.ts#a,b,c`) into its file path
 * and its (possibly empty) list of region names. A specifier with no `#`
 * resolves to the whole file (no regions). Shared with the docs-validation
 * test so the two stay in lock-step with what the remark plugin actually
 * resolves at MDX compile time.
 */
export function parseRegionSpecifier(specifier: string): {
  relativePath: string;
  regionNames: string[];
} {
  const trimmed = specifier.trim();
  const hashIdx = trimmed.lastIndexOf('#');
  const relativePath = hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx);
  const regionNames =
    hashIdx === -1
      ? []
      : trimmed
          .slice(hashIdx + 1)
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean);
  return { relativePath, regionNames };
}

// ---------------------------------------------------------------------------
// Minimal mdast shapes. We deliberately avoid importing @types/mdast /
// unist so this file has no dependency beyond node builtins.
// ---------------------------------------------------------------------------

interface MdxAttribute {
  type: string;
  name?: string;
  value?: unknown;
}

interface MdastNode {
  type: string;
  name?: string;
  value?: string;
  children?: MdastNode[];
  attributes?: MdxAttribute[];
  [key: string]: unknown;
}

interface RemarkFile {
  cwd: string;
  dirname?: string;
  data?: { _compiler?: { addDependency?: (p: string) => void } };
}

function isIncludeRegions(node: MdastNode): boolean {
  return (
    (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
    node.name === TAG_NAME
  );
}

function flattenText(node: MdastNode): string {
  if (node.children) {
    return node.children.map(flattenText).join('');
  }
  return typeof node.value === 'string' ? node.value : '';
}

function parseAttributes(node: MdastNode): Record<string, string | null> {
  const attrs: Record<string, string | null> = {};
  if (Array.isArray(node.attributes)) {
    for (const attr of node.attributes) {
      if (
        attr.type === 'mdxJsxAttribute' &&
        typeof attr.name === 'string' &&
        (typeof attr.value === 'string' || attr.value === null)
      ) {
        attrs[attr.name] = attr.value as string | null;
      }
    }
  }
  return attrs;
}

/** A located `<includeregions>` and the array slot it should replace. */
interface Found {
  /** The element carrying attributes + specifier. */
  element: MdastNode;
  /** The children array holding the slot to replace. */
  container: MdastNode[];
  /** Index into `container` to overwrite with the emitted `code` node. */
  index: number;
}

function isBlankText(node: MdastNode): boolean {
  return node.type === 'text' && /^\s*$/.test(node.value ?? '');
}

function collect(node: MdastNode, found: Found[]): void {
  const children = node.children;
  if (!Array.isArray(children)) {
    return;
  }
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (isIncludeRegions(child)) {
      found.push({ element: child, container: children, index: i });
      continue;
    }
    // A lone `<includeregions>` on its own line can be parsed as a text
    // element wrapped in a paragraph; unwrap it and replace the paragraph.
    if (child.type === 'paragraph' && Array.isArray(child.children)) {
      const meaningful = child.children.filter((c) => !isBlankText(c));
      if (meaningful.length === 1 && isIncludeRegions(meaningful[0])) {
        found.push({ element: meaningful[0], container: children, index: i });
        continue;
      }
    }
    collect(child, found);
  }
}

export function remarkMultiRegion() {
  return async (tree: MdastNode, file: RemarkFile): Promise<void> => {
    const found: Found[] = [];
    collect(tree, found);

    await Promise.all(
      found.map(async ({ element, container, index }) => {
        const specifier = flattenText(element).trim();
        if (specifier.length === 0) {
          return;
        }
        const attrs = parseAttributes(element);

        const { relativePath, regionNames } = parseRegionSpecifier(specifier);

        // `cwd` attribute resolves the path from the collection root
        // (file.cwd = website/), matching remark-include's convention.
        const base = 'cwd' in attrs ? file.cwd : (file.dirname ?? file.cwd);
        const targetPath = path.resolve(base, relativePath);

        let content: string;
        try {
          content = await fs.readFile(targetPath, 'utf-8');
        } catch (error) {
          throw new Error(
            `remark-multi-region: failed to read ${targetPath}\n${
              error instanceof Error ? error.message : String(error)
            }`,
            { cause: error },
          );
        }

        // Register for hot-reload the same way remark-include does.
        file.data?._compiler?.addDependency?.(targetPath);

        const value = regionNames.length
          ? regionNames.map((name) => extractCodeRegion(content, name)).join('\n\n')
          : content;

        const lang = attrs.lang ?? path.extname(targetPath).slice(1);
        const codeNode: MdastNode = {
          type: 'code',
          lang,
          meta: attrs.meta ?? null,
          value,
          data: {},
        };
        container[index] = codeNode;
      }),
    );
  };
}
