import type { TOCItemType } from 'fumadocs-core/toc';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import type { MDXContent } from 'mdx/types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { docsOptions } from '@/app/(docs)/layout.config';
import { source } from '@/app/source';
import { PageActions } from '@/components/docs/PageActions';
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

  const markdownUrl = `${page.url}.mdx`;
  const githubUrl = `https://github.com/hayes/pothos/blob/main/website/content/docs/${page.path}`;
  // Compact page utilities relocated out of the header into the TOC sidebar
  // (and the mobile TOC popover). Rendered in both so the links are reachable
  // at every breakpoint.
  const pageActions = <PageActions githubUrl={githubUrl} markdownUrl={markdownUrl} />;

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
        // Tighten the header rhythm: pull the eyebrow/title/description closer
        // together (gap-3) and trim the top padding below the sticky header
        // (xl:pt-10) so real content starts meaningfully higher.
        className="gap-3 xl:pt-10"
        // Below xl the sticky mobile TOC pill (grid-area:toc-popover) has a
        // collapsed row (`--fd-toc-popover-height` resolves to 0 in this
        // custom layout), so it overlaps and hides the breadcrumb at
        // scroll-top instead of sitting above it. The pill renders ~40px
        // tall; push the breadcrumb down far enough to clear it (with a
        // small gap) on those viewports. xl+ shows no pill and no margin.
        breadcrumb={{ className: 'max-xl:mt-14' }}
        // Page utilities live at the bottom of the TOC (desktop) and the TOC
        // popover (mobile) rather than in the header.
        tableOfContent={{ footer: pageActions }}
        tableOfContentPopover={{ footer: pageActions }}
      >
        <DocsTitle>{data.title}</DocsTitle>
        {data.description && (
          <DocsDescription className="mb-0">{data.description}</DocsDescription>
        )}
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
