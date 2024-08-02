import { pageTree } from '@/app/source';
import type { DocsLayoutProps } from 'fumadocs-ui/layout';
import Image from 'next/image';

// shared configuration
export const baseOptions = {
  githubUrl: 'https://github.com/hayes/pothos',
  nav: {
    title: <Image src="/assets/logo-name-auto.svg" alt="Pothos" width={125} height={30} />,
  },
  links: [
    {
      // icon: <BookIcon />,
      text: 'Discord',
      url: 'https://discord.gg/mNe73qvwAB',
    },
    {
      // icon: <GitHubIcon />,
      text: 'Examples',
      url: 'https://github.com/hayes/pothos/tree/main/examples',
    },
  ],
};

// docs layout configuration
export const docsOptions: DocsLayoutProps = {
  ...baseOptions,
  tree: pageTree,
};
