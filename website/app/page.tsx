import { getPage, getPages } from '@/app/source';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// biome-ignore lint/suspicious/useAwait: <explanation>
export default async function HomePage(_props: { params: { slug?: string[] } }) {
  const page = getPage([]);

  if (page == null) {
    notFound();
  }

  const MDX = page.data.exports.default;

  return (
    <DocsPage toc={page.data.exports.toc} full={page.data.full}>
      <DocsBody>
        <h1>{page.data.title}</h1>
        <MDX />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export function generateMetadata(): Metadata {
  const page = getPage([]);

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
