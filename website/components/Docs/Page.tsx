import { MDXProvider } from '@mdx-js/react';
import { Children, ReactNode } from 'react';
import { Layout } from '../Layout';
import { tableOfContents } from './Nav';
import { Toc } from './Toc';
import SyntaxHighlighter from 'react-syntax-highlighter';
import dracula from 'react-syntax-highlighter/dist/cjs/styles/hljs/dracula';

export interface BaseProps {
  children: ReactNode;
}

const components = {
  a: (props) => <a {...props} className="dark:!text-white" />,
  p: (props) => <p {...props} className="dark:!text-white" />,
  h1: (props) => <h1 {...props} className="dark:!text-white" />,
  h2: (props) => <h2 {...props} className="dark:!text-white" />,
  h3: (props) => <h3 {...props} className="dark:!text-white" />,
  h4: (props) => <h4 {...props} className="dark:!text-white" />,
  strong: (props) => <strong {...props} className="dark:!text-white" />,
  inlineCode: (props) => <code {...props} className="dark:!text-white" />,
  pre: (props) => <pre className="!p-0 !pt-0">{props.children}</pre>,
  code: (props) => <SyntaxHighlighter className="!m-0" language="typescript" style={dracula} >{props.children}</SyntaxHighlighter>
};

export function DocsPage({ children }: { children?: React.ReactNode }) {
  const items = Children.toArray(children)
    .filter((child: any) => child.props?.mdxType && ['h2', 'h3'].includes(child.props.mdxType))
    .map((child: any) => ({
      url: '#' + child.props.id,
      depth: (child.props?.mdxType && parseInt(child.props.mdxType.replace('h', ''), 0)) ?? 0,
      text: child.props.children,
    }));

  return (
      <Layout toc={tableOfContents}>
        <MDXProvider components={components}>
          <Toc className="fixed top-24 right-0 w-0 md:w-[calc(100%-min(800px,75%))] xl:w-[calc(50%-min(400px,37.5%))]" items={items} />
          <div className="prose">{children}</div>
        </MDXProvider>
    </Layout>
  );
}

