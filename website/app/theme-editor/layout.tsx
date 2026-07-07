import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Theme Editor',
  description:
    'Design and preview Monaco editor color themes for the Pothos GraphQL playground.',
};

export default function ThemeEditorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
