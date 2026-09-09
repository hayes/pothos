import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'Write a Pothos GraphQL schema in TypeScript and run queries against it right in the browser — no install, no codegen.',
};

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
