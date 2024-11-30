import { source } from '@/app/source';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export default async function HomePage(props: { params: Promise<{ slug?: string[] }> }) {
  const page = source.getPage((await props.params).slug);
  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsBody>
        <h1>{page.data.title}</h1>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

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
