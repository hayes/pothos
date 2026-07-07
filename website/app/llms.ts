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

// The MDX→text pipeline turns markdown images (`![alt](src)`) into JSX
// `<img>` tags whose `src` is an unresolved build-time import placeholder
// (`__img0`, `__img1`, …) — meaningless to an LLM/machine consumer and a
// dead link. These images are decorative (logos, diagrams), so strip the
// whole tag rather than emit a broken `src`.
function stripUnresolvedImages(text: string): string {
  return text.replace(/<img\b[^>]*\bsrc="__img\d+"[^>]*\/?>\s*/g, '');
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const p = page as unknown as PageWithGetText;
  const processed = stripUnresolvedImages(await p.data.getText('processed'));
  return `# ${p.data.title}
URL: ${p.url}
${p.data.description}
${processed}`;
}
