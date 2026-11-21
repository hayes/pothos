import { notFound } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';
import { getLLMText } from '@/app/llms';
import { source } from '@/app/source';

export const revalidate = false;

// A static export writes each URL to a file, and `/llms.mdx/migrations` (a file) would
// clash with the folder holding `/llms.mdx/migrations/v4`. So the static build adds `.mdx`
// to the last segment (`migrations.mdx`, root as `index.mdx`), and
// `scripts/build-static.mjs` moves the files to `/docs/<page>.mdx`.
const staticExport = process.env.STATIC_EXPORT === '1';

function pageSlug(slug: string[] = []) {
  if (!staticExport) {
    return slug;
  }
  const parts = slug.map((part, i) =>
    i === slug.length - 1 && part.endsWith('.mdx') ? part.slice(0, -'.mdx'.length) : part,
  );
  return parts.length === 1 && parts[0] === 'index' ? [] : parts;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(pageSlug(slug));
  if (!page) {
    notFound();
  }
  return new NextResponse(await getLLMText(page));
}

// Every page is prerendered; unknown slugs get the static 404 instead of an on-demand render.
export const dynamicParams = false;

export function generateStaticParams() {
  const params = source.generateParams();
  if (!staticExport) {
    return params;
  }
  return params.map(({ slug }) => ({
    slug: slug.length === 0 ? ['index.mdx'] : [...slug.slice(0, -1), `${slug.at(-1)}.mdx`],
  }));
}
