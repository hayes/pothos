import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return <RootProvider>{children}</RootProvider>;
}
