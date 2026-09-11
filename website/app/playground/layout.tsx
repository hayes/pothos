import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'Write a Pothos GraphQL schema in TypeScript and run queries against it in the browser, with nothing to install.',
};

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
