import { HTMLProps, ReactNode, useEffect, useRef, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import dracula from 'react-syntax-highlighter/dist/cjs/styles/hljs/dracula';
import Link from 'next/link';
import { MDXProvider } from '@mdx-js/react';
import { Layout } from '../Layout';
import { TableOfContents } from '../Toc';
import { Toc } from './Toc';

export interface BaseProps {
  children: ReactNode;
}

const components = {
  a: ({ href, ...props }: HTMLProps<HTMLAnchorElement>) => (
    <Link href={href!}>
      <a {...props} className="dark:!text-white" />
    </Link>
  ),
  p: (props: HTMLProps<HTMLParagraphElement>) => <p {...props} className="dark:!text-white" />,
  h1: (props: HTMLProps<HTMLHeadingElement>) => <h1 {...props} className="dark:!text-white" />,
  h2: (props: HTMLProps<HTMLHeadingElement>) => <h2 {...props} className="dark:!text-white" />,
  h3: (props: HTMLProps<HTMLHeadingElement>) => <h3 {...props} className="dark:!text-white" />,
  h4: (props: HTMLProps<HTMLHeadingElement>) => <h4 {...props} className="dark:!text-white" />,
  li: (props: HTMLProps<HTMLLIElement>) => <li {...props} className="dark:!text-white" />,
  strong: (props: HTMLProps<HTMLElement>) => <strong {...props} className="dark:!text-white" />,
  inlineCode: (props: HTMLProps<HTMLElement>) => <code {...props} className="dark:!text-white" />,
  pre: (props: HTMLProps<HTMLElement>) => <pre className="!p-0 !pt-0">{props.children}</pre>,
  code: (props: HTMLProps<HTMLElement>) => {
    const match = /language-(\w+)/.exec(props.className ?? '');
    return match ? (
      <SyntaxHighlighter className="!m-0" language={match[0]} style={dracula as unknown}>
        {props.children}
      </SyntaxHighlighter>
    ) : (
      <code
        {...props}
        className="text-white bg-[#1f2937] rounded before:content-[''] after:content-[''] px-1"
      />
    );
  },
};

export function DocsPage({ children, nav }: { children?: React.ReactNode; nav: TableOfContents }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<
    {
      url: string;
      depth: number;
      text: string;
    }[]
  >([]);

  useEffect(() => {
    setItems(
      // eslint-disable-next-line unicorn/prefer-spread
      Array.from(bodyRef.current?.querySelectorAll('h2, h3') ?? []).map((header) => ({
        url: `#${header.id}`,
        depth: Number.parseInt(header.tagName.replace('H', ''), 10) ?? 0,
        text: header.textContent ?? '',
      })),
    );
  }, []);

  return (
    <Layout toc={nav}>
      <MDXProvider components={components}>
        <Toc
          className="fixed top-24 right-0 hidden md:block md:w-[calc(100%-min(800px,75%))] xl:w-[calc(50%-min(400px,37.5%))]"
          items={items}
          nav={nav}
        />
        <div ref={bodyRef} className="prose">
          {children}
        </div>
      </MDXProvider>
    </Layout>
  );
}
