import type { TOCItemType } from 'fumadocs-core/toc';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import type { MDXContent } from 'mdx/types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { docsOptions } from '@/app/(docs)/layout.config';
import { source } from '@/app/source';
import { LLMCopyButton, ViewOptions } from '@/components/ai/page-actions';
import { useMDXComponents } from '@/mdx-components';

interface MDXPageData {
  title?: string;
  description?: string;
  full?: boolean;
  body: MDXContent;
  toc: TOCItemType[];
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const page = source.getPage((await params).slug);

  if (page == null) {
    notFound();
  }

  const data = page.data as unknown as MDXPageData;
  const MDX = data.body;

  // DocsLayout provides the React context DocsPage needs (TOC, sidebar
  // toggle, etc.). Sidebar + nav are disabled because the (docs) layout
  // already renders our own Header and Sidebar above this column.
  return (
    <DocsLayout
      {...docsOptions}
      nav={{ enabled: false }}
      sidebar={{ enabled: false }}
      links={docsOptions.links}
    >
      <DocsPage toc={data.toc} full={data.full}>
        <DocsBody>
          <h1>{data.title}</h1>
          <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
            <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
            <ViewOptions
              markdownUrl={`${page.url}.mdx`}
              githubUrl={`https://github.com/hayes/pothos/blob/main/website/content/docs/${page.path}`}
            />
          </div>
          <MDX components={useMDXComponents({})} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

// biome-ignore lint/suspicious/useAwait: this needs to return a promise
export async function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const page = source.getPage((await params).slug);

  if (page == null) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
