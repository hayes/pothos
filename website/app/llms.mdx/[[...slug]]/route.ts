import { notFound } from 'next/navigation';
import { type NextRequest, NextResponse } from 'next/server';
import { getLLMText } from '@/app/llms';
import { source } from '@/app/source';
export const revalidate = false;
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }
  return new NextResponse(await getLLMText(page));
}
// Every docs page is prerendered; answer unknown slugs with the static 404 instead of
// rendering them on demand (which costs a function call and an ISR write per URL).
export const dynamicParams = false;

export function generateStaticParams() {
  return source.generateParams();
}
