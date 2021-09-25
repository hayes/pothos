import { MDXProvider } from '@mdx-js/react';
import { Children, ReactNode } from 'react';
import { Layout } from '../Layout';
import { tableOfContents } from './Nav';
import { Toc } from './Toc';

export interface BaseProps {
  children: ReactNode;
}

const components = {};

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
          <div className="prose lg:prose-xl w-full">{children}</div>
        </MDXProvider>
    </Layout>
  );
}

