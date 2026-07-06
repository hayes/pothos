import type { TOCItemType } from 'fumadocs-core/toc';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import type { MDXContent } from 'mdx/types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { docsOptions } from '@/app/(docs)/layout.config';
import { source } from '@/app/source';
import { LLMCopyButton } from '@/components/ai/LLMCopyButton';
import { ViewOptions } from '@/components/ai/ViewOptions';
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
      <DocsPage
        toc={data.toc}
        full={data.full}
        // Below xl the sticky mobile TOC pill (grid-area:toc-popover) has a
        // collapsed row (`--fd-toc-popover-height` resolves to 0 in this
        // custom layout), so it overlaps and hides the breadcrumb at
        // scroll-top instead of sitting above it. The pill renders ~40px
        // tall; push the breadcrumb down far enough to clear it (with a
        // small gap) on those viewports. xl+ shows no pill and no margin.
        breadcrumb={{ className: 'max-xl:mt-14' }}
      >
        <DocsTitle>{data.title}</DocsTitle>
        {data.description && <DocsDescription>{data.description}</DocsDescription>}
        <div className="flex flex-row gap-2 items-center border-b pb-4 mb-6 mt-2">
          <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
          <ViewOptions
            markdownUrl={`${page.url}.mdx`}
            githubUrl={`https://github.com/hayes/pothos/blob/main/website/content/docs/${page.path}`}
          />
        </div>
        <DocsBody>
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

  // OpenGraph/Twitter titles and descriptions are auto-filled per page by
  // Next from these fields (see the root layout's shared og/twitter
  // defaults), so a shared docs link renders a correct preview card.
  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
  };
}
