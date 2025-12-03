import type { TOCItemType } from 'fumadocs-core/toc';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import type { MDXContent } from 'mdx/types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { source } from '@/app/source';

interface MDXPageData {
  title?: string;
  description?: string;
  body: MDXContent;
  toc: TOCItemType[];
}

export default async function HomePage(props: { params: Promise<{ slug?: string[] }> }) {
  const page = source.getPage((await props.params).slug);
  if (!page) {
    notFound();
  }

  const data = page.data as unknown as MDXPageData;
  const MDX = data.body;

  return (
    <DocsPage toc={data.toc}>
      <DocsBody>
        <h1>{data.title}</h1>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

// biome-ignore lint/suspicious/useAwait: this needs to return a promise
export async function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export function generateMetadata(): Metadata {
  const page = source.getPage([]);

  if (page == null) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
  } satisfies Metadata;
}

// export default function HomePage() {
//   return (
//     <main className="flex h-screen flex-col justify-center text-center">
//       <h1 className="mb-4 text-2xl font-bold">Hello World</h1>
//       <p className="text-muted-foreground">
//         You can open{' '}
//         <Link href="/docs" className="text-foreground font-semibold underline">
//           /docs
//         </Link>{' '}
//         and see the documentation.
//       </p>
//     </main>
//   );
// }
