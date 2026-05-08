import type { ComponentProps } from 'react';
import { PlaygroundCodeBlock } from './PlaygroundCodeBlock';

/**
 * Universal base64 decoder. Uses `atob` in the browser (which works
 * without a Node-style `Buffer` polyfill) and `Buffer` on the server.
 * Inline + tiny so it inlines into the bundle on tree-shake.
 */
function decodeBase64(s: string): string {
  if (typeof window !== 'undefined') {
    // Browser path — `atob` returns a binary string; round-trip through
    // a UTF-8 decoder so multi-byte characters survive.
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }
  return Buffer.from(s, 'base64').toString('utf8');
}

/**
 * Custom pre component that handles playground meta attributes.
 * This component is used in MDX to support interactive playground code blocks.
 */
export function PreComponent(props: ComponentProps<'pre'>) {
  // Extract custom data attributes added by our Shiki transformer
  const propsWithData = props as ComponentProps<'pre'> & {
    'data-playground'?: string;
    'data-example'?: string;
    'data-query'?: string;
    'data-raw-code'?: string;
  };

  const hasPlayground = propsWithData['data-playground'] === 'true';
  const exampleId = propsWithData['data-example'];
  const query = propsWithData['data-query'];

  // Decode the raw code if available
  let rawCode: string | undefined;
  if (propsWithData['data-raw-code']) {
    try {
      rawCode = decodeBase64(propsWithData['data-raw-code']);
    } catch (err) {
      console.error('Failed to decode raw code:', err);
    }
  }

  return (
    <PlaygroundCodeBlock
      {...props}
      playground={hasPlayground}
      exampleId={exampleId}
      query={query}
      code={rawCode}
    />
  );
}
