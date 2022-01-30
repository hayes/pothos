import { useRouter } from 'next/router';
import { TableOfContents, TableOfContentsEntry } from '../Toc';

export function useCurrentDocsPage(tableOfContents: TableOfContents) {
  const router = useRouter();

  const flatEntries = tableOfContents.entries.flatMap((entry) => [
    entry,
    ...(entry.children ?? []),
  ]);

  const entry = flatEntries.find((e) => e.link === router.pathname);

  if (!entry) {
    return null;
  }

  const index = flatEntries.indexOf(entry);

  const prevPage = flatEntries[index - 1] as TableOfContentsEntry | undefined;
  const nextPage = flatEntries[index + 1] as TableOfContentsEntry | undefined;

  return {
    ...entry,
    githubFile: `https://github.com/hayes/pothos/edit/main/website/pages${entry.link}${
      entry.children ? '/index.mdx' : '.mdx'
    }`,
    prevPage,
    nextPage,
  };
}
