import type { InferPageType } from 'fumadocs-core/source';
import type { source } from './source';

interface PageWithGetText {
  url: string;
  data: {
    title?: string;
    description?: string;
    getText: (type: 'processed') => Promise<string>;
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const p = page as unknown as PageWithGetText;
  const processed = await p.data.getText('processed');
  return `# ${p.data.title}
URL: ${p.url}
${p.data.description}
${processed}`;
}
