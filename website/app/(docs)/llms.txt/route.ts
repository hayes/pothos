import { source } from '@/app/source';

const BASE_URL = 'https://pothos-graphql.dev';

// cached forever
export const revalidate = false;

export function GET() {
  const lines = source.getPages().map((page) => {
    const data = page.data as unknown as { title?: string; description?: string };
    const description = data.description ? `: ${data.description}` : '';

    return `- [${data.title}](${BASE_URL}${page.url}.mdx)${description}`;
  });

  return new Response(`# Pothos GraphQL

> Pothos is a plugin based GraphQL schema builder for typescript

Each page below is available as plain markdown at the listed .mdx URL.
The full documentation in a single file: ${BASE_URL}/llms-full.txt

## Docs

${lines.join('\n')}
`);
}
