import { Children, HTMLProps, ReactElement, ReactNode } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import dracula from 'react-syntax-highlighter/dist/cjs/styles/hljs/dracula';
import Link from 'next/link';
import { MDXProvider } from '@mdx-js/react';
import { Layout } from '../Layout';
import { tableOfContents } from './Nav';
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
  strong: (props: HTMLProps<HTMLElement>) => <strong {...props} className="dark:!text-white" />,
  inlineCode: (props: HTMLProps<HTMLElement>) => <code {...props} className="dark:!text-white" />,
  pre: (props: HTMLProps<HTMLElement>) => <pre className="!p-0 !pt-0">{props.children}</pre>,
  code: (props: HTMLProps<HTMLElement>) => (
    <SyntaxHighlighter className="!m-0" language="typescript" style={dracula as unknown}>
      {props.children}
    </SyntaxHighlighter>
  ),
};

export function DocsPage({ children }: { children?: React.ReactNode }) {
  const items = Children.toArray(children)
    .filter((child) => {
      const { mdxType } = (child as ReactElement).props as { mdxType: string };

      return ['h2', 'h3'].includes(mdxType);
    })
    .map((child) => {
      const props = (child as ReactElement).props as {
        id: string;
        mdxType: string;
        children: string;
      };

      return {
        url: `#${props.id}`,
        depth: Number.parseInt(props.mdxType.replace('h', ''), 10) ?? 0,
        text: props.children,
      };
    });

  return (
    <Layout toc={tableOfContents}>
      <MDXProvider components={components}>
        <Toc
          className="fixed top-24 right-0 hidden md:block md:w-[calc(100%-min(800px,75%))] xl:w-[calc(50%-min(400px,37.5%))]"
          items={items}
        />
        <div className="prose">{children}</div>
      </MDXProvider>
    </Layout>
  );
}
