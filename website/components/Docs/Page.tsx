import { Children, ReactNode } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import dracula from 'react-syntax-highlighter/dist/cjs/styles/hljs/dracula';
import { MDXProvider } from '@mdx-js/react';
import { Layout } from '../Layout';
import { tableOfContents } from './Nav';
import { Toc } from './Toc';
import Link from 'next/link';

export interface BaseProps {
  children: ReactNode;
}

const components = {
  a: ({ href, ...props }) => (
    <Link href={href}>
      <a {...props} className="dark:!text-white" />
    </Link>
  ),
  p: (props) => <p {...props} className="dark:!text-white" />,
  h1: (props) => <h1 {...props} className="dark:!text-white" />,
  h2: (props) => <h2 {...props} className="dark:!text-white" />,
  h3: (props) => <h3 {...props} className="dark:!text-white" />,
  h4: (props) => <h4 {...props} className="dark:!text-white" />,
  strong: (props) => <strong {...props} className="dark:!text-white" />,
  inlineCode: (props) => <code {...props} className="dark:!text-white" />,
  pre: (props: BaseProps) => <pre className="!p-0 !pt-0">{props.children}</pre>,
  code: (props: BaseProps) => (
    <SyntaxHighlighter className="!m-0" language="typescript" style={dracula as unknown}>
      {props.children}
    </SyntaxHighlighter>
  ),
};

export function DocsPage({ children }: { children?: React.ReactNode }) {
  const items = Children.toArray(children)
    .filter(
      (child: { props?: { mdxType: string } }) =>
        child.props?.mdxType && ['h2', 'h3'].includes(child.props.mdxType),
    )
    .map((child: { props?: BaseProps & { mdxType: string; id: string } }) => ({
      url: `#${child.props.id}`,
      depth:
        (child.props?.mdxType && Number.parseInt(child.props.mdxType.replace('h', ''), 10)) ?? 0,
      text: child.props.children,
    }));

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
