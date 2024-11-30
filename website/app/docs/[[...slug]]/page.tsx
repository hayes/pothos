import { source } from '@/app/source';
import { useMDXComponents } from '@/mdx-components';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const page = source.getPage((await params).slug);

  if (page == null) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsBody>
        <h1>{page.data.title}</h1>
        <MDX components={useMDXComponents({})} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const page = source.getPage((await params).slug);

  if (page == null) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
