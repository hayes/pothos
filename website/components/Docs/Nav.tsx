import { useRouter } from 'next/router';
import { TableOfContents } from '../Toc';

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

  return {
    ...entry,
    githubFile: `https://github.com/hayes/giraphql/edit/mh-pothos/website/pages${entry.link}${
      entry.children ? '/index.mdx' : '.mdx'
    }`,
  };
}
