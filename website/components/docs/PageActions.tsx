'use client';
import { useCopyButton } from 'fumadocs-ui/utils/use-copy-button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { GitHubIcon } from '@/components/icons/GitHubIcon';

const cache = new Map<string, string>();

const linkClass =
  'inline-flex items-center gap-2 text-left transition-colors hover:text-fd-accent-foreground [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fd-muted-foreground';

/**
 * Compact page utilities that live at the bottom of the TOC sidebar instead
 * of the page header: an "Edit on GitHub" link (source file on `main`) and a
 * small "Copy as Markdown" action. The raw `.mdx` route stays available for
 * machines/LLMs without needing a button of its own.
 */
export function PageActions({
  githubUrl,
  markdownUrl,
}: {
  /** Source file URL on GitHub. */
  githubUrl: string;
  /** URL to the raw Markdown/MDX content of the page. */
  markdownUrl: string;
}) {
  const [isLoading, setLoading] = useState(false);
  const [checked, onCopy] = useCopyButton(async () => {
    const cached = cache.get(markdownUrl);
    if (cached) {
      return navigator.clipboard.writeText(cached);
    }

    setLoading(true);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': fetch(markdownUrl).then(async (res) => {
            const content = await res.text();
            cache.set(markdownUrl, content);
            return content;
          }),
        }),
      ]);
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="mt-4 flex flex-col gap-2.5 border-t border-fd-border pt-4 text-sm text-fd-muted-foreground">
      <a href={githubUrl} target="_blank" rel="noreferrer noopener" className={linkClass}>
        <GitHubIcon />
        Edit on GitHub
      </a>
      <button type="button" disabled={isLoading} onClick={onCopy} className={linkClass}>
        {checked ? <Check /> : <Copy />}
        {checked ? 'Copied!' : 'Copy as Markdown'}
      </button>
    </div>
  );
}
